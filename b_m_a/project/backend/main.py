import os
import json
import uuid
import uvicorn
import shutil
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, HTTPException, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from json_repair import repair_json
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional, Union

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, Body, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import msal
from jose import jwt

# Your existing helpers
from pdf_utils import extract_text_from_pdf
from openai_client import generate_quiz, generate_answer_explanation, evaluate_short_answer, generate_study_plan, update_study_plan, summarize_text, generate_flashcard as openai_generate_flashcard, analyze_quiz_performance
from models import VoiceNoteResponse, QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse, QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest, UpdateStudyPlanResponse, Flashcard, FlashcardDeck, SaveFlashcardResponse, FlashcardDocument 
from pydantic import BaseModel
import shutil
from fastapi.responses import FileResponse

# Load the environment variables
load_dotenv()

# Create FastAPI app instance
app = FastAPI(title="Blue Marble Academy API")

AUDIO_FOLDER = "audio_files"
os.makedirs(AUDIO_FOLDER, exist_ok=True)
voice_notes: List[dict] = []

@app.get("/voice-notes", response_model=List[VoiceNoteResponse])
async def get_voice_notes():
    return voice_notes

@app.post("/voice-notes", response_model=VoiceNoteResponse)
async def create_voice_note(
    title: str = Form(...),
    text: str = Form(...),
    folder: str = Form(...),
    duration: int = Form(...),
    visibility: str = Form(...),
    audio: UploadFile = File(...)
):
    try:
        note_id = str(uuid.uuid4())
        filename = f"{note_id}.webm"
        file_path = os.path.join(AUDIO_FOLDER, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        note = {
            "id": note_id,
            "title": title,
            "text": text,
            "folder": folder,
            "duration": duration,
            "visibility": visibility,
            "timestamp": datetime.utcnow().isoformat(),
            "audio_url": f"/audio/{filename}"
        }

        voice_notes.append(note)
        return note
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving voice note: {e}")

@app.get("/audio/{filename}")
async def get_audio(filename: str):
    file_path = os.path.join(AUDIO_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/webm")

# Add CORS middleware to allow the frontend React app to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # dev: open; lock down in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-User-Id"],
)

# static for audio
os.makedirs("static/audio", exist_ok=True)
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception:
    pass

# ----------------------------
# Storage abstraction (Cosmos or Local JSON)
# ----------------------------

COSMOS_URL = (
    os.getenv("COSMOS_DB_URL")
    or os.getenv("COSMOS_URL")
    or os.getenv("COSMOS_ENDPOINT")
)
COSMOS_KEY = os.getenv("COSMOS_DB_KEY") or os.getenv("COSMOS_KEY")
COSMOS_DB_NAME = os.getenv("COSMOS_DB_NAME", "notes-db")
COSMOS_CONTAINER_NAME = os.getenv("COSMOS_CONTAINER_NAME", "voice-notes")
COSMOS_PARTITION_KEY_PATH = os.getenv("COSMOS_PARTITION_KEY_PATH", "/userId")

STORAGE_MODE = "cosmos" if (COSMOS_URL and COSMOS_KEY) else "local"

# ---------- Local JSON store ----------
class LocalContainer:
    """
    Minimal emulation of the Cosmos container methods we use:
      - create_item(body)
      - read_item(item=<id>, partition_key=<pk>)
      - replace_item(item=<id>, body=<obj>)
      - delete_item(item=<id>, partition_key=<pk>)
      - query_items(query=<sql_like>, parameters=[...], enable_cross_partition_query=True)
    Stores items in JSON files by `contentType` or route usage.
    """
    def __init__(self, root_dir: str):
        self.root = root_dir
        os.makedirs(self.root, exist_ok=True)
        # We’ll keep all records in one file to simplify queries.
        self.file = os.path.join(self.root, "items.json")
        if not os.path.exists(self.file):
            with open(self.file, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _load(self) -> List[Dict[str, Any]]:
        with open(self.file, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                return []

    def _save(self, items: List[Dict[str, Any]]):
        with open(self.file, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

    def create_item(self, body: Dict[str, Any]):
        items = self._load()
        items.append(body)
        self._save(items)
        return body

    def read_item(self, item: str, partition_key: Optional[str] = None):
        items = self._load()
        for it in items:
            if it.get("id") == item:
                # optional basic partition check (ignored if not present)
                pk_value = None
                # we accept either userId or user_id in stored objects
                if "userId" in it:
                    pk_value = it["userId"]
                elif "user_id" in it:
                    pk_value = it["user_id"]
                if partition_key is not None and pk_value is not None and pk_value != partition_key:
                    # simulate cosmos "not found" when partition key doesn't match
                    break
                return it
        raise HTTPException(status_code=404, detail="Item not found")

    def replace_item(self, item: str, body: Dict[str, Any]):
        items = self._load()
        for idx, it in enumerate(items):
            if it.get("id") == item:
                items[idx] = body
                self._save(items)
                return body
        raise HTTPException(status_code=404, detail="Item not found")

    def delete_item(self, item: str, partition_key: Optional[str] = None):
        items = self._load()
        new_items = []
        found = False
        for it in items:
            if it.get("id") == item:
                # optional partition check
                pk_value = it.get("userId") or it.get("user_id")
                if partition_key is not None and pk_value is not None and pk_value != partition_key:
                    new_items.append(it)  # wrong pk, keep
                else:
                    found = True
            else:
                new_items.append(it)
        if not found:
            raise HTTPException(status_code=404, detail="Item not found")
        self._save(new_items)
        return {"message": "deleted"}

    def query_items(self, query: str, parameters: Optional[List[Dict[str, Any]]] = None, enable_cross_partition_query: bool = True):
        """
        We only support the few query patterns used by this app.
        """
        items = self._load()

        # Build a param lookup dict
        params = {p["name"]: p["value"] for p in (parameters or [])}

        q = query.replace("\n", " ").strip().lower()

        def contains_ci(hay: Optional[str], needle: str) -> bool:
            return hay is not None and needle in hay.lower()

        # Pattern 1: voice-notes by user (and optional folder)
        if "from c where c.user_id = @user_id" in q:
            user_id = params.get("@user_id")
            filtered = [self._ensure_defaults(it) for it in items if it.get("user_id") == user_id]
            if "and c.folder = @folder" in q:
                folder = params.get("@folder")
                filtered = [it for it in filtered if it.get("folder") == folder]
            return filtered

        # Pattern 2: public voice notes (with optional folder and q)
        if "from c where c.visibility = 'public'" in q:
            filtered = [self._ensure_defaults(it) for it in items if it.get("visibility") == "Public"]
            if "and c.folder = @folder" in q:
                folder = params.get("@folder")
                filtered = [it for it in filtered if it.get("folder") == folder]
            if "contains(lower(c.title), @q)" in q or "contains(lower(c.text), @q)" in q:
                needle = (params.get("@q") or "").lower()
                filtered = [
                    it for it in filtered
                    if contains_ci(it.get("title") or "", needle) or contains_ci(it.get("text") or "", needle)
                ]
            return filtered

        # Pattern 3: quizzes by userId
        if "from c where c.userid = @userid and c.contenttype = 'quiz'" in q:
            user_id = params.get("@userid")
            filtered = [it for it in items if (it.get("userId") == user_id and it.get("contentType") == "quiz")]
            # ORDER BY c.createdAt DESC (we'll just sort)
            filtered.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            return filtered

        # Pattern 4: study_plan list by userId
        if "from c where c.userid = '" in q and "and c.contenttype = 'study_plan'" in q:
            # crude parse for user id inside the query string
            try:
                start = q.index("c.userid = '") + len("c.userid = '")
                end = q.index("'", start)
                uid_inline = query[start:end]  # keep original case
            except Exception:
                uid_inline = None
            filtered = [it for it in items if (it.get("userId") == uid_inline and it.get("contentType") == "study_plan")]
            filtered.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            return filtered

        # Default: return everything (dev convenience)
        return items

    @staticmethod
    def _ensure_defaults(item: Dict[str, Any]) -> Dict[str, Any]:
        item.setdefault("title", None)
        item.setdefault("text", "")
        item.setdefault("folder", "General")
        item.setdefault("duration", None)
        item.setdefault("visibility", "Private")
        item.setdefault("timestamp", datetime.utcnow().isoformat())
        if "audioUrl" in item and "audio_url" not in item:
            item["audio_url"] = item.pop("audioUrl")
        item.setdefault("audio_url", None)
        item.setdefault("tags", [])
        item.setdefault("settings", {})
        return item


# Create a "container" depending on mode
storage_mode = STORAGE_MODE
cosmos_error: Optional[str] = None
if storage_mode == "cosmos":
    try:
        from azure.cosmos import CosmosClient, PartitionKey
        cosmos_client = CosmosClient(COSMOS_URL, credential=COSMOS_KEY)
        _database = cosmos_client.get_database_client(COSMOS_DB_NAME)
        # IMPORTANT: do not attempt to create DB/Container to avoid RU issues.
        container = _database.get_container_client(COSMOS_CONTAINER_NAME)
        # Warm-up a simple call to confirm existence
        list(container.query_items(query="SELECT TOP 1 * FROM c", enable_cross_partition_query=True))
    except Exception as e:
        cosmos_error = str(e)
        storage_mode = "local"
        container = LocalContainer("./_localdb")
else:
    container = LocalContainer("./_localdb")

# ----------------------------
# Helpers
# ----------------------------

def _resolve_user_id(request: Request, user_id_q: Optional[str] = None, user_id_form: Optional[str] = None) -> str:
    return user_id_q or user_id_form or request.headers.get("X-User-Id") or "default"

def _ensure_defaults(item: Dict[str, Any]) -> Dict[str, Any]:
    # mirrors LocalContainer defaults for consistency
    item.setdefault("title", None)
    item.setdefault("text", "")
    item.setdefault("folder", "General")
    item.setdefault("duration", None)
    item.setdefault("visibility", "Private")
    item.setdefault("timestamp", datetime.utcnow().isoformat())
    if "audioUrl" in item and "audio_url" not in item:
        item["audio_url"] = item.pop("audioUrl")
    item.setdefault("audio_url", None)
    item.setdefault("tags", [])
    item.setdefault("settings", {})
    return item

# ----------------------------
# Auth (dev-friendly)
# ----------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_msal_app():
    return msal.ConfidentialClientApplication(
        client_id=os.getenv("CLIENT_ID"),
        authority=os.getenv("AUTHORITY"),
        client_credential=os.getenv("CLIENT_SECRET")
    )

async def validate_token(token: str = Depends(oauth2_scheme)):
    try:
        # Dev mode: skip real verification
        decoded_token = jwt.decode(
            token,
            key="development_key_not_for_production",
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False}
        )
        if not decoded_token.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: no 'sub'")
        return decoded_token
    except Exception as e:
        # If you truly want to allow no token during dev, uncomment:
        # return {"sub": "dev-user"}
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication failed: {e}")

# ----------------------------
# Routes
# ----------------------------

@app.get("/")
def read_root():
    return {"message": "Backend is running", "storage": storage_mode, "cosmos_error": cosmos_error}

@app.get("/health")
def health_check():
    if storage_mode == "cosmos":
        status_obj = "ok" if cosmos_error is None else f"error: {cosmos_error}"
    else:
        status_obj = "local-ok"
    return {"status": "healthy", "storage": storage_mode, "cosmos": status_obj}

# ----- Voice Notes -----

@app.get("/voice-notes")
async def get_voice_notes(request: Request, user_id: Optional[str] = Query(None), folder: Optional[str] = Query(None)):
    uid = _resolve_user_id(request, user_id_q=user_id)
    if folder:
        query = "SELECT * FROM c WHERE c.user_id = @user_id AND c.folder = @folder"
        params = [{"name": "@user_id", "value": uid}, {"name": "@folder", "value": folder}]
    else:
        query = "SELECT * FROM c WHERE c.user_id = @user_id"
        params = [{"name": "@user_id", "value": uid}]
    try:
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        results = [_ensure_defaults(it) for it in items]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/voice-notes")
async def create_voice_note(
    request: Request,
    audio: UploadFile = File(...),
    title: Optional[str] = Form(None),
    text: str = Form(""),
    folder: str = Form("General"),
    duration: Optional[int] = Form(None),
    visibility: str = Form("Private"),
    user_id: Optional[str] = Form(None),
):
    uid = _resolve_user_id(request, user_id_form=user_id)
    note_id = str(uuid.uuid4())

    # Save audio
    ext = os.path.splitext(audio.filename or "")[1] or ".webm"
    audio_dir = os.path.join("static", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    filename = f"{note_id}{ext}"
    file_path = os.path.join(audio_dir, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    base_url = str(request.base_url).rstrip("/")
    audio_url = f"{base_url}/static/audio/{filename}"

    item: Dict[str, Any] = {
        "id": note_id,
        "user_id": uid,
        "title": title,
        "text": text,
        "folder": folder or "General",
        "duration": duration,
        "visibility": visibility or "Private",
        "timestamp": datetime.utcnow().isoformat(),
        "audio_url": audio_url,
        "tags": [],
        "settings": {},
        "contentType": "voice_note",  # helpful in local store
    }
    try:
        container.create_item(item)
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/voice-notes/{note_id}")
async def update_voice_note(
    note_id: str,
    request: Request,
    updates: Dict[str, Any] = Body(...),
    user_id: Optional[str] = Query(None),
):
    uid = _resolve_user_id(request, user_id_q=user_id)
    try:
        item = container.read_item(item=note_id, partition_key=uid)
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")

    if "audioUrl" in updates and "audio_url" not in updates:
        updates["audio_url"] = updates.pop("audioUrl")

    allowed = {"title","text","folder","duration","visibility","tags","settings","audio_url","timestamp"}
    for k in list(updates.keys()):
        if k not in allowed:
            updates.pop(k, None)

    if "settings" in updates and isinstance(updates["settings"], dict):
        s = item.get("settings", {}) or {}
        s.update(updates["settings"])
        updates["settings"] = s
    if "tags" in updates and updates["tags"] is None:
        updates["tags"] = []

    item.update(updates)
    try:
        container.replace_item(item=note_id, body=item)
        return _ensure_defaults(item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/voice-notes/{note_id}")
async def delete_voice_note(note_id: str, request: Request, user_id: Optional[str] = Query(None)):
    uid = _resolve_user_id(request, user_id_q=user_id)
    try:
        container.delete_item(item=note_id, partition_key=uid)
        return {"message": "Note deleted"}
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")

@app.get("/public/voice-notes")
async def public_voice_notes(
    q: Optional[str] = Query(None, description="Search term for title/text"),
    folder: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500, description="Max items to return"),
):
    if folder and q:
        query = (
            "SELECT * FROM c WHERE c.visibility = 'Public' "
            "AND c.folder = @folder AND (CONTAINS(LOWER(c.title), @q) OR CONTAINS(LOWER(c.text), @q))"
        )
        params = [{"name": "@folder", "value": folder}, {"name": "@q", "value": (q or "").lower()}]
    elif folder:
        query = "SELECT * FROM c WHERE c.visibility = 'Public' AND c.folder = @folder"
        params = [{"name": "@folder", "value": folder}]
    elif q:
        query = (
            "SELECT * FROM c WHERE c.visibility = 'Public' "
            "AND (CONTAINS(LOWER(c.title), @q) OR CONTAINS(LOWER(c.text), @q))"
        )
        params = [{"name": "@q", "value": (q or "").lower()}]
    else:
        query = "SELECT * FROM c WHERE c.visibility = 'Public'"
        params = []

    try:
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        results = [_ensure_defaults(it) for it in items]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----- Quizzes -----

# Pydantic models for these endpoints
class QuizDataModel(BaseModel):
    title: Optional[str] = None
    questions: Any
    userAnswers: Optional[Any] = None
    score: Optional[Any] = None
    timeTaken: Optional[int] = 0
    resourceName: Optional[str] = None
    options: Optional[Dict[str, Any]] = None
    attempts: Optional[List[Dict[str, Any]]] = []

class QuizDocument(BaseModel):
    contentType: str
    data: QuizDataModel

class SavedQuizResponse(BaseModel):
    id: str
    message: str

class SaveQuizAttemptRequest(BaseModel):
    quizId: str
    score: Optional[Any]
    timeTaken: Optional[int]
    userAnswers: Any
    mode: Optional[str] = "default"

class SaveQuizAttemptResponse(BaseModel):
    quizId: str
    attemptId: str
    message: str

@app.post("/generate-quiz")
async def create_quiz(
    file: UploadFile = File(...),
    num_questions: Optional[int] = Form(10),
    focus_topics: Optional[str] = Form(""),
    question_formats: Optional[str] = Form("{}"),
    user_claims: dict = Depends(validate_token)
):
    try:
        print(f"Generating quiz for user: {user_claims['sub']}")
        print(f"File: {file.filename}, Questions: {num_questions}")
        
        # Save the uploaded file temporarily
        file_path = f"./temp_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())

        text = extract_text_from_pdf(file_path)
        print(f"Extracted text length: {len(text)} characters")
        
        # Parse question formats from string to dict
        try:
            formats_dict = json.loads(question_formats)
        except json.JSONDecodeError:
            formats_dict = {
                "multiple_choice": True,
                "multi_select": True,
                "drag_and_drop": True
            }
        
        # Get selected formats as a list
        selected_formats = [format for format, selected in formats_dict.items() if selected]
        
        # Validate inputs
        if num_questions < 10:
            num_questions = 10
        elif num_questions > 40:
            num_questions = 40
            
        if not selected_formats:
            selected_formats = ["multiple_choice"]
            
        print(f"Selected formats: {selected_formats}")
        print(f"Focus topics: {focus_topics}")
            
        # Generate quiz using Azure OpenAI with customization options
        quiz_json = generate_quiz(
            text=text,
            num_questions=num_questions,
            focus_topics=focus_topics.strip(),
            question_formats=selected_formats
        )

        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Parse the generated quiz JSON
        try:
            quiz_data = json.loads(quiz_json)
        except json.JSONDecodeError as e:
            print(f"Error parsing quiz JSON: {e}")
            print(f"Raw quiz JSON: {quiz_json}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to parse generated quiz data"
            )
        
        # Generate a unique ID for the quiz
        quiz_id = str(uuid.uuid4())
        
        # Prepare quiz document for database
        quiz_document = {
            "id": quiz_id,
            "userId": user_claims["sub"],
            "contentType": "quiz",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": quiz_data.get("quiz_title", "Generated Quiz"),
                "questions": quiz_data.get("questions", []),
                "userAnswers": None,
                "score": None,
                "timeTaken": 0,
                "resourceName": file.filename,
                "options": {
                    "numQuestions": num_questions,
                    "selectedTopics": focus_topics.split(",") if focus_topics else [],
                    "customTopics": focus_topics,
                    "questionFormats": formats_dict
                },
                "attempts": []
            }
        }
        
        # Save to Cosmos DB
        try:
            container.create_item(body=quiz_document)
            print(f"Quiz saved to database with ID: {quiz_id}")
        except Exception as db_error:
            print(f"Database error: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save quiz to database: {str(db_error)}"
            )
        
        # Return the quiz data with the ID
        response_data = {
            "id": quiz_id,
            "quiz_title": quiz_data.get("quiz_title", "Generated Quiz"),
            "questions": quiz_data.get("questions", [])
        }
        
        print(f"Quiz generation successful. ID: {quiz_id}, Questions: {len(response_data['questions'])}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        # Clean up temporary file if it exists
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}"
        )

@app.post("/save-quiz", response_model=SavedQuizResponse)
async def save_quiz(quiz: QuizDocument, user_claims: dict = Depends(validate_token)):
    try:
        print(f"Saving quiz for user: {user_claims['sub']}")
        
        # Prepare document for Cosmos DB
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz.data.dict()
        }
        
        # Save to Cosmos DB
        try:
            container.create_item(body=document)
            print(f"Quiz saved successfully with ID: {document['id']}")
            return {"id": document["id"], "message": "Quiz saved successfully"}
        except Exception as db_error:
            print(f"Database error saving quiz: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Failed to save quiz to database: {str(db_error)}"
            )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error saving quiz: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save quiz: {e}")

@app.post("/save-quiz-attempt", response_model=SaveQuizAttemptResponse)
async def save_quiz_attempt(attempt: SaveQuizAttemptRequest, user_claims: dict = Depends(validate_token)):
    try:
        quiz_id = attempt.quizId
        quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
        if quiz.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")

        attempt_id = str(uuid.uuid4())
        new_attempt = {
            "attemptId": attempt_id,
            "timestamp": datetime.utcnow().isoformat(),
            "score": attempt.score,
            "timeTaken": attempt.timeTaken,
            "userAnswers": attempt.userAnswers,
            "mode": attempt.mode
        }

        if "attempts" not in quiz["data"]:
            quiz["data"]["attempts"] = []
        quiz["data"]["attempts"].append(new_attempt)

        container.replace_item(item=quiz_id, body=quiz)
        return {"quizId": quiz_id, "attemptId": attempt_id, "message": "Quiz attempt saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving quiz attempt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save quiz attempt: {e}")

@app.get("/quizzes")
async def get_quizzes(user_claims: dict = Depends(validate_token)):
    try:
        print(f"Fetching quizzes for user: {user_claims['sub']}")
        
        # Query parameters for Cosmos DB
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'quiz' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        
        # Query Cosmos DB
        try:
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            print(f"Found {len(items)} quizzes for user")
            return items
        except Exception as db_error:
            print(f"Database error fetching quizzes: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Failed to fetch quizzes from database: {str(db_error)}"
            )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error fetching quizzes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch quizzes: {e}")

@app.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
        if quiz.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return quiz
    except Exception as e:
        print(f"Error fetching quiz: {e}")
        raise HTTPException(status_code=404, detail="Quiz not found")

@app.get("/quizzes/{quiz_id}/with-history")
async def get_quiz_with_history(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
        if quiz.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return quiz
    except Exception as e:
        print(f"Error fetching quiz with history: {e}")
        raise HTTPException(status_code=404, detail="Quiz not found")

# Health check endpoint - public
@app.get("/health")
def health_check():
    try:
        # Test database connection
        try:
            # Try to query the database
            query = "SELECT VALUE COUNT(1) FROM c"
            result = list(container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            db_status = "connected"
            db_count = result[0] if result else 0
        except Exception as db_error:
            db_status = f"error: {str(db_error)}"
            db_count = 0
        
        # Test environment variables
        env_status = {
            "cosmos_db_url": "SET" if os.getenv("COSMOS_DB_URL") else "NOT SET",
            "cosmos_db_key": "SET" if os.getenv("COSMOS_DB_KEY") else "NOT SET",
            "openai_endpoint": "SET" if os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT") else "NOT SET",
            "openai_api_key": "SET" if os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_API_KEY") else "NOT SET",
            "openai_deployment": "SET" if os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME") else "NOT SET"
        }
        
        return {
            "status": "healthy",
            "database": {
                "status": db_status,
                "document_count": db_count
            },
            "environment": env_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# Explanation request model
class ExplanationRequest(BaseModel):
    question: Dict[str, Any]
    userAnswer: Any
    isCorrect: bool

# Explanation response model
class ExplanationResponse(BaseModel):
    explanation: str

# Generate answer explanation endpoint - protected
@app.post("/explain-answer", response_model=ExplanationResponse)
async def explain_answer(request: ExplanationRequest, user_claims: dict = Depends(validate_token)):
    try:
        # Call the OpenAI API to generate an explanation
        explanation = generate_answer_explanation(
            question=request.question,
            user_answer=request.userAnswer,
            is_correct=request.isCorrect
        )
        
        return {"explanation": explanation}
    except Exception as e:
        print(f"Error generating explanation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate explanation: {str(e)}"
        )

# Short answer evaluation request model
class ShortAnswerEvaluationRequest(BaseModel):
    question: Dict[str, Any]
    userAnswer: str

# Short answer evaluation response model
class ShortAnswerEvaluationResponse(BaseModel):
    isCorrect: bool
    aiResponse: str

# Evaluate short answer endpoint - protected
@app.post("/evaluate-short-answer", response_model=ShortAnswerEvaluationResponse)
async def evaluate_answer(request: ShortAnswerEvaluationRequest, user_claims: dict = Depends(validate_token)):
    try:
        # Call the OpenAI API to evaluate the short answer
        result = evaluate_short_answer(
            question=request.question,
            user_answer=request.userAnswer
        )
        
        return {"isCorrect": result["is_correct"], "aiResponse": result["ai_response"]}
    except Exception as e:
        print(f"Error evaluating short answer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate answer: {str(e)}"
        )

# Study plan generation endpoint - protected
@app.post("/generate-study-plan", response_model=Dict[str, Any])
async def create_study_plan(
    files: List[UploadFile] = File(...),
    title: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    duration_metadata: Optional[str] = Form(None),
    user_claims: dict = Depends(validate_token)
):
    try:
        if not files:
            raise HTTPException(status_code=422, detail="No files provided")
        if not title:
            raise HTTPException(status_code=422, detail="Title is required")

        all_text = ""
        pdf_names = []

        for file in files:
            if not file.filename.lower().endswith(".pdf"):
                raise HTTPException(status_code=422, detail=f"File {file.filename} is not a PDF")
            file_path = f"./temp_{file.filename}"
            with open(file_path, "wb") as f:
                f.write(await file.read())
            try:
                text = extract_text_from_pdf(file_path)
                all_text += text + "\n\n"
                pdf_names.append(file.filename)
            finally:
                if os.path.exists(file_path):
                    try: os.remove(file_path)
                    except: pass

        if not all_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract any text from the provided PDFs")

        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        duration_info = None
        if duration_metadata:
            try:
                duration_info = json.loads(duration_metadata)
            except json.JSONDecodeError:
                duration_info = None

        study_plan_json = generate_study_plan(
            text=all_text, title=title, tags=tag_list, duration_info=duration_info
        )
        study_plan_data = json.loads(study_plan_json)

        study_plan_document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": "study_plan",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": title,
                "description": description if description else study_plan_data.get("description", ""),
                "content": study_plan_data,
                "tags": tag_list,
                "pdfs": pdf_names,
                "duration_info": duration_info,
                "updatedAt": None
            }
        }
        container.create_item(body=study_plan_document)
        return {"id": study_plan_document["id"], "plan": study_plan_data, "message": "Study plan created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating study plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate study plan: {e}")

@app.get("/study-plans")
async def get_study_plans(user_claims: dict = Depends(validate_token)):
    try:
        query = f"SELECT * FROM c WHERE c.userId = '{user_claims['sub']}' AND c.contentType = 'study_plan' ORDER BY c.createdAt DESC"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        study_plans = [{
            "id": item["id"],
            "title": item["data"]["title"],
            "description": item["data"]["description"],
            "tags": item["data"]["tags"],
            "createdAt": item["createdAt"],
            "updatedAt": item["data"]["updatedAt"]
        } for item in items]
        return {"study_plans": study_plans}
    except Exception as e:
        print(f"Error retrieving study plans: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve study plans: {e}")

@app.get("/study-plans/{plan_id}")
async def get_study_plan(plan_id: str, user_claims: dict = Depends(validate_token)):
    try:
        study_plan = container.read_item(item=plan_id, partition_key=user_claims["sub"])
        if study_plan.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return study_plan
    except Exception as e:
        print(f"Error retrieving study plan: {e}")
        raise HTTPException(status_code=404, detail="Study plan not found")

@app.post("/update-study-plan", response_model=UpdateStudyPlanResponse)
async def update_study_plan_endpoint(request: UpdateStudyPlanRequest, user_claims: dict = Depends(validate_token)):
    try:
        plan_id = request.planId
        study_plan = container.read_item(item=plan_id, partition_key=user_claims["sub"])
        if study_plan.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")

        quiz_results = []
        for quiz_id in request.quizIds:
            try:
                quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
                attempts = quiz.get("data", {}).get("attempts") or []
                if not attempts:
                    continue
                latest_attempt = max(attempts, key=lambda x: x.get("timestamp", ""))
                quiz_results.append({
                    "quizId": quiz_id,
                    "title": quiz.get("data", {}).get("title", ""),
                    "score": latest_attempt.get("score"),
                    "timestamp": latest_attempt.get("timestamp"),
                    "questions": quiz.get("data", {}).get("questions"),
                    "userAnswers": latest_attempt.get("userAnswers"),
                    "tags": study_plan["data"]["tags"]
                })
            except Exception:
                continue

        updated_plan_json = update_study_plan(
            original_plan=study_plan["data"]["content"],
            quiz_results=quiz_results
        )
        updated_plan_data = json.loads(updated_plan_json)

        study_plan["data"]["content"] = updated_plan_data
        study_plan["data"]["updatedAt"] = datetime.utcnow().isoformat()
        
        # Save to Cosmos DB
        container.replace_item(
            item=plan_id,
            body=study_plan
        )
        
        return {
            "id": plan_id,
            "message": "Study plan updated successfully",
            "updatedPlan": updated_plan_data
        }
    except Exception as e:
        print(f"Error updating study plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update study plan: {str(e)}"
        )

@app.post("/summarize")
async def summarize_file(
    file: UploadFile = None, 
    text: str = Body(None)
):
    print("🔍 Entered /summarize route")

    if not file and not text:
        raise HTTPException(status_code=400, detail="Please provide a file or text.")
    try:
        if file:
            allowed = ["application/pdf", "text/plain"]
            if file.content_type not in allowed:
                raise HTTPException(status_code=400, detail="Invalid file type.")
            file_location = f"temp_{file.filename}"
            with open(file_location, "wb") as f:
                f.write(await file.read())
            if file.content_type == "application/pdf":
                extracted_text = extract_text_from_pdf(file_location)
            else:
                with open(file_location, "r", encoding="utf-8") as tf:
                    extracted_text = tf.read()
            os.remove(file_location)
        else:
            extracted_text = text

        summary = summarize_text(extracted_text)
        return {"summary": summary}
    except Exception as e:
        print(f"Summarize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"summary": summary}

# Quiz Performance Analysis Models
class QuizPerformanceRequest(BaseModel):
    questions: List[Dict[str, Any]]
    userAnswers: List[Any]
    quizMetadata: Optional[Dict[str, Any]] = {}

class QuizPerformanceResponse(BaseModel):
    topics: List[Dict[str, Any]]
    weakTopics: List[Dict[str, Any]]
    strongTopics: List[Dict[str, Any]]
    recommendations: List[str]
    overallAnalysis: Dict[str, Any]

@app.post("/analyze-quiz-performance", response_model=QuizPerformanceResponse)
async def analyze_quiz_performance_endpoint(
    request: QuizPerformanceRequest, 
    user_claims: dict = Depends(validate_token)
):
    try:
        print(f"Analyzing quiz performance for user: {user_claims['sub']}")
        
        # Analyze quiz performance using AI
        analysis_result = await analyze_quiz_performance(
            request.questions, 
            request.userAnswers, 
            request.quizMetadata
        )
        
        return analysis_result
        
    except Exception as e:
        print(f"Error in analyze-quiz-performance endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error analyzing quiz performance: {str(e)}"
        )

# For development purposes
if __name__ == "__main__":
    # 0.0.0.0 so your browser/other clients can hit it
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Save flashcard endpoint - protected 
@app.post("/save-flashcard", response_model=SaveFlashcardResponse)
async def save_flashcard(flashcard: FlashcardDocument, user_claims: dict = Depends(validate_token)):
    try:
        # Prepare document for Cosmos DB
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],  
            "contentType": flashcard.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": flashcard.data.dict()  
        }
        
        # Save to Cosmos DB
        container.create_item(body=document)
        return {"id": document["id"], "message": "Flashcards saved successfully"}
    except Exception as e:
        print(f"Error saving flashcards: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save flashcards: {str(e)}"
        )
    
# Get all flashcard decks for a user - protected
@app.get("/decks")
async def get_decks(user_claims: dict = Depends(validate_token)):
    try:
        # Query parameters for Cosmos DB
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'flashcard' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        
        # Query Cosmos DB
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        return items
    except Exception as e:
        print(f"Error fetching decks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to fetch decks: {str(e)}"
        )

# Get a specific deck by ID - protected
@app.get("/decks/{deck_id}")
async def get_decks(deck_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the deck from Cosmos DB (using partition key)
        quiz = container.read_item(
            item=deck_id, 
            partition_key=user_claims["sub"]
        )
        
        # Verify the deck belongs to the user
        if quiz["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access denied"
            )
            
        return quiz
    except Exception as e:
        print(f"Error fetching deck: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Deck not found"
        )

