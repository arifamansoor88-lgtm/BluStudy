import os
import json
import uuid
import uvicorn
import base64
import mimetypes
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union

import msal
from jose import jwt
from dotenv import load_dotenv
from fastapi import (
    FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, Body, Request
)
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel

# ---- Cosmos DB client/container from your project ----
from database import client, container

# ---- Utilities / OpenAI helpers ----
from pdf_utils import extract_text_from_pdf
from openai_client import (
    generate_quiz,
    generate_answer_explanation,
    evaluate_short_answer,
    generate_study_plan,
    update_study_plan,
    summarize_text
)

# ---- Your data models (kept as-is) ----
from models import (
    VoiceNoteResponse, QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse,
    QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest,
    UpdateStudyPlanResponse
)

load_dotenv()

# --------------------------------------------------------------------------------------
# App setup & CORS
# --------------------------------------------------------------------------------------
def _parse_origins() -> List[str]:
    env = os.getenv("FRONTEND_ORIGINS")
    if env:
        return [o.strip() for o in env.split(",") if o.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]

app = FastAPI(title="AI Education Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-User-Id"],
)

# Static mount (kept; we do NOT store audio locally)
os.makedirs("static", exist_ok=True)
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception:
    pass

# --------------------------------------------------------------------------------------
# Storage configuration
# --------------------------------------------------------------------------------------
STORAGE_BACKEND = (os.getenv("STORAGE_BACKEND") or "azure_blob").strip().lower()
# For azure_blob
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_BLOB_ACCOUNT_NAME = os.getenv("AZURE_BLOB_ACCOUNT_NAME")
AZURE_BLOB_ACCOUNT_KEY = os.getenv("AZURE_BLOB_ACCOUNT_KEY")
AZURE_BLOB_CONTAINER = os.getenv("AZURE_BLOB_CONTAINER", "audio")
AZURE_BLOB_SAS_TTL_HOURS = int(os.getenv("AZURE_BLOB_SAS_TTL_HOURS", "0"))

# --------------------------------------------------------------------------------------
# Helpers: user id, tags, defaults
# --------------------------------------------------------------------------------------
from datetime import datetime as _dt
import uuid as _uuid

def _resolve_user_id(request: Request, user_id_q: Optional[str] = None, user_id_form: Optional[str] = None) -> str:
    return user_id_q or user_id_form or request.headers.get("X-User-Id") or "default"

def _normalize_tags(raw: Optional[Union[str, List[str]]]) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        parts: List[str] = []
        for r in raw:
            parts.extend([p.strip() for p in str(r).split(",") if p.strip()])
    else:
        parts = [p.strip() for p in str(raw).split(",") if p.strip()]
    seen_lower, out = set(), []
    for t in parts:
        key = t.lower()
        if key not in seen_lower:
            seen_lower.add(key)
            out.append(t)
    return out

def _guess_content_type(filename: Optional[str]) -> str:
    if not filename:
        return "audio/webm"
    ct, _ = mimetypes.guess_type(filename)
    if ct:
        return ct
    low = filename.lower()
    if low.endswith(".m4a"):
        return "audio/mp4"
    if low.endswith(".mp3"):
        return "audio/mpeg"
    if low.endswith(".wav"):
        return "audio/wav"
    if low.endswith(".ogg"):
        return "audio/ogg"
    return "audio/webm"

def _ensure_note_defaults(item: Dict[str, Any]) -> Dict[str, Any]:
    item.pop("folder", None)
    item.setdefault("title", None)
    item.setdefault("text", "")
    item.setdefault("duration", None)
    item.setdefault("visibility", "Private")
    item.setdefault("timestamp", _dt.utcnow().isoformat())
    if "audioUrl" in item and "audio_url" not in item:
        item["audio_url"] = item.pop("audioUrl")
    item.setdefault("audio_url", None)
    item["tags"] = _normalize_tags(item.get("tags", []))
    item.setdefault("settings", {})
    return item

_ensure_defaults = _ensure_note_defaults

def _attach_playback_urls(item: Dict[str, Any], request: Request) -> Dict[str, Any]:
    """
    Ensure the document has a stable playback URL that includes owner id so the
    frontend can play private notes without adding headers/query params.
    """
    base_url = str(request.base_url).rstrip("/")
    owner = item.get("userId") or item.get("user_id") or "default"
    # ALWAYS include ?user_id=<owner> so private-note checks pass
    playback_url = f"{base_url}/voice-notes/{item['id']}/audio?user_id={owner}"
    item["playback_url"] = playback_url
    item["audio_url"] = playback_url
    item["audioUrl"] = playback_url
    return item

# --------------------------------------------------------------------------------------
# Azure Blob helper (only when STORAGE_BACKEND=azure_blob)
# --------------------------------------------------------------------------------------
def _upload_to_azure_blob(file_bytes: bytes, blob_name: str, content_type: str) -> str:
    try:
        from azure.storage.blob import BlobServiceClient, ContentSettings, generate_blob_sas, BlobSasPermissions
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="azure-storage-blob not installed. Run: pip install azure-storage-blob"
        )

    if AZURE_STORAGE_CONNECTION_STRING:
        bsc = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    else:
        if not (AZURE_BLOB_ACCOUNT_NAME and AZURE_BLOB_ACCOUNT_KEY):
            raise HTTPException(
                status_code=500,
                detail="Azure Blob credentials missing. Set AZURE_STORAGE_CONNECTION_STRING or AZURE_BLOB_ACCOUNT_NAME + AZURE_BLOB_ACCOUNT_KEY."
            )
        account_url = f"https://{AZURE_BLOB_ACCOUNT_NAME}.blob.core.windows.net"
        bsc = BlobServiceClient(account_url=account_url, credential=AZURE_BLOB_ACCOUNT_KEY)

    container_client = bsc.get_container_client(AZURE_BLOB_CONTAINER)
    # Ensure container exists (idempotent)
    try:
        container_client.create_container()
    except Exception:
        pass

    blob_client = container_client.get_blob_client(blob_name)

    blob_client.upload_blob(
        file_bytes,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type)
    )

    blob_url = blob_client.url

    if AZURE_BLOB_SAS_TTL_HOURS and (AZURE_BLOB_ACCOUNT_NAME and AZURE_BLOB_ACCOUNT_KEY):
        expiry = datetime.utcnow() + timedelta(hours=AZURE_BLOB_SAS_TTL_HOURS)
        sas = generate_blob_sas(
            account_name=AZURE_BLOB_ACCOUNT_NAME,
            container_name=AZURE_BLOB_CONTAINER,
            blob_name=blob_name,
            account_key=AZURE_BLOB_ACCOUNT_KEY,
            permission=BlobSasPermissions(read=True),
            expiry=expiry
        )
        return f"{blob_url}?{sas}"

    return blob_url

# --------------------------------------------------------------------------------------
# Voice Notes API (Tags, Cosmos storage) — audio in Azure Blob or inline Cosmos
# Each note has:
#   - audio_url      -> ALWAYS backend endpoint /voice-notes/{id}/audio?user_id=<owner>
#   - audio_blob_url -> only when azure_blob (target for redirect)
#   - audio_inline_b64 -> only when cosmos_inline (backend streams it)
# --------------------------------------------------------------------------------------

@app.get("/voice-notes")
async def get_voice_notes(
    request: Request,
    user_id: Optional[str] = Query(None),
    tag: Optional[List[str]] = Query(None, description="Repeatable: ?tag=math&tag=lecture"),
):
    uid = _resolve_user_id(request, user_id_q=user_id)
    tags = _normalize_tags(tag)

    query = "SELECT * FROM c WHERE c.userId = @uid AND c.contentType = 'voice_note'"
    params = [{"name": "@uid", "value": uid}]

    if tags:
        conds = []
        for i, t in enumerate(tags):
            pname = f"@t{i}"
            params.append({"name": pname, "value": t})
            conds.append(f"ARRAY_CONTAINS(c.tags, {pname}, true)")
        query += " AND " + " AND ".join(conds)

    items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
    results: List[Dict[str, Any]] = []
    for it in items:
        it = _ensure_note_defaults(it)
        it = _attach_playback_urls(it, request)
        results.append(it)
    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return results

@app.post("/voice-notes")
async def create_voice_note(
    request: Request,
    audio: UploadFile = File(...),
    title: Optional[str] = Form(None),
    text: str = Form(""),
    tags: Optional[str] = Form(None),
    duration: Optional[int] = Form(None),
    visibility: str = Form("Private"),
    user_id: Optional[str] = Form(None),
):
    uid = _resolve_user_id(request, user_id_form=user_id)
    note_id = str(_uuid.uuid4())

    try:
        file_bytes = await audio.read()
    finally:
        await audio.close()

    filename = audio.filename or f"{note_id}.webm"
    content_type = _guess_content_type(filename)

    # Store audio
    audio_blob_url = None
    audio_inline_b64 = None

    if STORAGE_BACKEND == "azure_blob":
        blob_name = f"{note_id}{os.path.splitext(filename)[1] or ''}"
        audio_blob_url = _upload_to_azure_blob(file_bytes, blob_name, content_type)
    elif STORAGE_BACKEND == "cosmos_inline":
        audio_inline_b64 = base64.b64encode(file_bytes).decode("ascii")
    else:
        raise HTTPException(status_code=500, detail="Invalid STORAGE_BACKEND. Use 'azure_blob' or 'cosmos_inline'.")

    # Build doc; audio_url points to backend endpoint INCLUDING owner query param
    base_url = str(request.base_url).rstrip("/")
    playback_url = f"{base_url}/voice-notes/{note_id}/audio?user_id={uid}"

    item: Dict[str, Any] = {
        "id": note_id,
        "userId": uid,
        "contentType": "voice_note",
        "title": title,
        "text": text,
        "tags": _normalize_tags(tags),
        "duration": duration,
        "visibility": visibility or "Private",
        "timestamp": _dt.utcnow().isoformat(),
        "settings": {},
        "audio_url": playback_url,          # <- frontend consumes this
        "audio_blob_url": audio_blob_url,   # <- used internally for redirect
        "audio_inline_b64": audio_inline_b64,  # <- used internally for streaming
        "audio_filename": filename,
        "audio_content_type": content_type,
    }

    container.create_item(body=item)

    item = _ensure_note_defaults(item)
    item = _attach_playback_urls(item, request)  # ensures aliases
    return item

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

    if item.get("contentType") != "voice_note":
        raise HTTPException(status_code=404, detail="Note not found")

    if "audioUrl" in updates and "audio_url" not in updates:
        updates.pop("audioUrl", None)

    allowed = {"title","text","tags","duration","visibility","settings","timestamp"}
    for k in list(updates.keys()):
        if k not in allowed:
            updates.pop(k, None)

    if "settings" in updates and isinstance(updates["settings"], dict):
        s = item.get("settings", {}) or {}
        s.update(updates["settings"])
        updates["settings"] = s

    if "tags" in updates:
        updates["tags"] = _normalize_tags(updates["tags"])

    item.update(updates)

    # Re-assert stable fields
    item["userId"] = uid
    item["id"] = note_id
    # Keep audio_url pointing to our endpoint and include owner param
    base_url = str(request.base_url).rstrip("/")
    item["audio_url"] = f"{base_url}/voice-notes/{note_id}/audio?user_id={uid}"

    container.upsert_item(body=item)

    item = _ensure_note_defaults(item)
    item = _attach_playback_urls(item, request)
    return item

@app.delete("/voice-notes/{note_id}")
async def delete_voice_note(note_id: str, request: Request, user_id: Optional[str] = Query(None)):
    uid = _resolve_user_id(request, user_id_q=user_id)
    try:
        existing = container.read_item(item=note_id, partition_key=uid)
        if existing.get("contentType") != "voice_note":
            raise HTTPException(status_code=404, detail="Note not found")
        container.delete_item(item=note_id, partition_key=uid)
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}

@app.get("/public/voice-notes")
async def public_voice_notes(
    request: Request,
    q: Optional[str] = Query(None, description="Search term for title/text"),
    tag: Optional[List[str]] = Query(None, description="Repeatable: ?tag=math&tag=lecture"),
    limit: int = Query(100, ge=1, le=500, description="Max items to return"),
):
    tags = _normalize_tags(tag)

    query = "SELECT * FROM c WHERE c.contentType = 'voice_note' AND c.visibility = 'Public'"
    params: List[Dict[str, Any]] = []

    if q:
        params.append({"name": "@q", "value": (q or "").lower()})
        query += " AND (CONTAINS(LOWER(c.title), @q) OR CONTAINS(LOWER(c.text), @q))"

    if tags:
        conds = []
        for i, t in enumerate(tags):
            pname = f"@t{i}"
            params.append({"name": pname, "value": t})
            conds.append(f"ARRAY_CONTAINS(c.tags, {pname}, true)")
        query += " AND " + " AND ".join(conds)

    items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
    results = []
    for it in items:
        it = _ensure_note_defaults(it)
        it = _attach_playback_urls(it, request)
        results.append(it)
    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return results[:limit]

# ---- Audio fetcher: stream inline (cosmos_inline) or redirect to blob URL (azure_blob) ----
def _stream_inline_audio(item: Dict[str, Any]) -> StreamingResponse:
    b64 = item.get("audio_inline_b64")
    if not b64:
        raise HTTPException(status_code=404, detail="Inline audio not present")
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupt inline audio")
    ctype = item.get("audio_content_type") or _guess_content_type(item.get("audio_filename"))
    return StreamingResponse(iter([raw]), media_type=ctype)

@app.get("/voice-notes/{note_id}/audio")
async def get_voice_note_audio(
    note_id: str,
    request: Request,
    user_id: Optional[str] = Query(None),
):
    uid = _resolve_user_id(request, user_id_q=user_id)

    item = None
    try:
        item = container.read_item(item=note_id, partition_key=uid)
    except Exception:
        pass

    if not item:
        q = "SELECT * FROM c WHERE c.id = @id"
        res = list(container.query_items(
            query=q,
            parameters=[{"name": "@id", "value": note_id}],
            enable_cross_partition_query=True
        ))
        if res:
            item = res[0]
        else:
            raise HTTPException(status_code=404, detail="Audio not found")

    if item.get("contentType") != "voice_note":
        raise HTTPException(status_code=404, detail="Audio not found")

    vis = (item.get("visibility") or "Private").capitalize()
    owner = item.get("userId") or item.get("user_id")
    if vis != "Public" and owner != uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this audio")

    # Inline stream
    if item.get("audio_inline_b64"):
        return _stream_inline_audio(item)

    # Redirect to Azure Blob URL (note: use audio_blob_url, not audio_url, to avoid loops)
    blob = (item.get("audio_blob_url") or "").strip()
    if blob.startswith("http://") or blob.startswith("https://"):
        return RedirectResponse(url=blob, status_code=307)

    raise HTTPException(status_code=404, detail="Audio location not found")

# Optional: quick debug (does not return the base64 audio)
@app.get("/voice-notes/{note_id}/debug")
async def debug_voice_note(
    note_id: str,
    request: Request,
    user_id: Optional[str] = Query(None),
):
    uid = _resolve_user_id(request, user_id_q=user_id)
    doc = None
    try:
        doc = container.read_item(item=note_id, partition_key=uid)
    except Exception:
        q = "SELECT * FROM c WHERE c.id = @id"
        res = list(container.query_items(
            query=q,
            parameters=[{"name": "@id", "value": note_id}],
            enable_cross_partition_query=True
        ))
        if res:
            doc = res[0]
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    scrub = dict(doc)
    scrub.pop("audio_inline_b64", None)
    return JSONResponse(scrub)

# --------------------------------------------------------------------------------------
# Auth helpers
# --------------------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_msal_app():
    return msal.ConfidentialClientApplication(
        client_id=os.getenv("CLIENT_ID"),
        authority=os.getenv("AUTHORITY"),
        client_credential=os.getenv("CLIENT_SECRET")
    )

async def validate_token(token: str = Depends(oauth2_scheme)):
    try:
        dummy_key = "development_key_not_for_production"
        decoded_token = jwt.decode(
            token,
            key=dummy_key,
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False
            }
        )
        if not decoded_token.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims - missing 'sub' claim"
            )
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )

# --------------------------------------------------------------------------------------
# Root & Health
# --------------------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {"message": "Backend is running and connected to Cosmos DB!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# --------------------------------------------------------------------------------------
# Quiz / Attempts / Study Plan / Summarize — unchanged logic, upsert for updates
# --------------------------------------------------------------------------------------

@app.post("/generate-quiz")
async def create_quiz(
    file: UploadFile = File(...), 
    num_questions: Optional[int] = Form(10),
    focus_topics: Optional[str] = Form(""),
    question_formats: Optional[str] = Form("{}"),
    user_claims: dict = Depends(validate_token)
):
    try:
        file_path = f"./temp_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())
        text = extract_text_from_pdf(file_path)
        if os.path.exists(file_path):
            os.remove(file_path)

        try:
            formats_dict = json.loads(question_formats)
        except:
            formats_dict = {
                "multiple_choice": True,
                "multi_select": True,
                "drag_and_drop": True
            }

        selected_formats = [fmt for fmt, selected in formats_dict.items() if selected]
        num_questions = max(10, min(40, int(num_questions or 10)))
        if not selected_formats:
            selected_formats = ["multiple_choice"]

        quiz_json = generate_quiz(
            text=text,
            num_questions=num_questions,
            focus_topics=focus_topics.strip(),
            question_formats=selected_formats
        )

        quiz_data = json.loads(quiz_json)
        quiz_document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": "quiz",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": quiz_data["quiz_title"],
                "questions": quiz_data["questions"],
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

        container.create_item(body=quiz_document)
        quiz_data["id"] = quiz_document["id"]
        return quiz_data
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}"
        )

@app.post("/save-quiz", response_model=SavedQuizResponse)
async def save_quiz(quiz: QuizDocument, user_claims: dict = Depends(validate_token)):
    try:
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],  
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz.data.dict()  
        }
        container.create_item(body=document)
        return {"id": document["id"], "message": "Quiz saved successfully"}
    except Exception as e:
        print(f"Error saving quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save quiz: {str(e)}"
        )

@app.post("/save-quiz-attempt", response_model=SaveQuizAttemptResponse)
async def save_quiz_attempt(attempt: SaveQuizAttemptRequest, user_claims: dict = Depends(validate_token)):
    try:
        quiz_id = attempt.quizId
        try:
            quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
            if quiz["userId"] != user_claims["sub"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        except Exception as e:
            print(f"Error retrieving quiz: {str(e)}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

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

        container.upsert_item(body=quiz)

        return {"quizId": quiz_id, "attemptId": attempt_id, "message": "Quiz attempt saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving quiz attempt: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save quiz attempt: {str(e)}")

@app.get("/quizzes")
async def get_quizzes(user_claims: dict = Depends(validate_token)):
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'quiz' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return items
    except Exception as e:
        print(f"Error fetching quizzes: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch quizzes: {str(e)}")

@app.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
        if quiz["userId"] != user_claims["sub"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return quiz
    except Exception as e:
        print(f"Error fetching quiz: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

@app.get("/quizzes/{quiz_id}/with-history")
async def get_quiz_with_history(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
        if quiz["userId"] != user_claims["sub"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return quiz
    except Exception as e:
        print(f"Error fetching quiz with history: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

class ExplanationRequest(BaseModel):
    question: Dict[str, Any]
    userAnswer: Any
    isCorrect: bool

class ExplanationResponse(BaseModel):
    explanation: str

@app.post("/explain-answer", response_model=ExplanationResponse)
async def explain_answer(request: ExplanationRequest, user_claims: dict = Depends(validate_token)):
    try:
        explanation = generate_answer_explanation(
            question=request.question,
            user_answer=request.userAnswer,
            is_correct=request.isCorrect
        )
        return {"explanation": explanation}
    except Exception as e:
        print(f"Error generating explanation: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate explanation: {str(e)}")

class ShortAnswerEvaluationRequest(BaseModel):
    question: Dict[str, Any]
    userAnswer: str

class ShortAnswerEvaluationResponse(BaseModel):
    isCorrect: bool
    aiResponse: str

@app.post("/evaluate-short-answer", response_model=ShortAnswerEvaluationResponse)
async def evaluate_answer(request: ShortAnswerEvaluationRequest, user_claims: dict = Depends(validate_token)):
    try:
        result = evaluate_short_answer(question=request.question, user_answer=request.userAnswer)
        return {"isCorrect": result["is_correct"], "aiResponse": result["ai_response"]}
    except Exception as e:
        print(f"Error evaluating short answer: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to evaluate answer: {str(e)}")

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
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No files provided")
        if not title:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title is required")

        all_text = ""
        pdf_names = []
        for file in files:
            if not file.filename.lower().endswith(".pdf"):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"File {file.filename} is not a PDF")
            file_path = f"./temp_{file.filename}"
            try:
                with open(file_path, "wb") as f:
                    f.write(await file.read())
                text = extract_text_from_pdf(file_path)
                all_text += text + "\n\n"
                pdf_names.append(file.filename)
            finally:
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass

        if not all_text.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not extract any text from the provided PDFs")

        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        duration_info = None
        if duration_metadata:
            try:
                duration_info = json.loads(duration_metadata)
            except json.JSONDecodeError:
                pass

        try:
            study_plan_json = generate_study_plan(
                text=all_text,
                title=title,
                tags=tag_list,
                duration_info=duration_info
            )
        except Exception as openai_error:
            print(f"Error calling OpenAI: {str(openai_error)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating study plan with AI: {str(openai_error)}")

        try:
            study_plan_data = json.loads(study_plan_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error parsing AI response. The generated study plan was not valid JSON.")

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
        print(f"Error generating study plan: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate study plan: {str(e)}")

@app.get("/study-plans")
async def get_study_plans(user_claims: dict = Depends(validate_token)):
    try:
        query = "SELECT * FROM c WHERE c.userId = @uid AND c.contentType = 'study_plan' ORDER BY c.createdAt DESC"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@uid", "value": user_claims["sub"]}],
            enable_cross_partition_query=True
        ))
        study_plans = []
        for item in items:
            study_plans.append({
                "id": item["id"],
                "title": item["data"]["title"],
                "description": item["data"]["description"],
                "tags": item["data"]["tags"],
                "createdAt": item["createdAt"],
                "updatedAt": item["data"]["updatedAt"]
            })
        return {"study_plans": study_plans}
    except Exception as e:
        print(f"Error retrieving study plans: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve study plans: {str(e)}")

@app.get("/study-plans/{plan_id}")
async def get_study_plan(plan_id: str, user_claims: dict = Depends(validate_token)):
    try:
        study_plan = container.read_item(item=plan_id, partition_key=user_claims["sub"])
        if study_plan["userId"] != user_claims["sub"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return study_plan
    except Exception as e:
        print(f"Error retrieving study plan: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study plan not found")

@app.post("/update-study-plan", response_model=UpdateStudyPlanResponse)
async def update_study_plan_endpoint(request: UpdateStudyPlanRequest, user_claims: dict = Depends(validate_token)):
    try:
        plan_id = request.planId
        try:
            study_plan = container.read_item(item=plan_id, partition_key=user_claims["sub"])
            if study_plan["userId"] != user_claims["sub"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        except Exception as e:
            print(f"Error retrieving study plan: {str(e)}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study plan not found")

        quiz_results = []
        for quiz_id in request.quizIds:
            try:
                quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
                if not quiz["data"].get("attempts"):
                    continue
                latest_attempt = max(quiz["data"]["attempts"], key=lambda x: x["timestamp"])
                quiz_results.append({
                    "quizId": quiz_id,
                    "title": quiz["data"].get("title", ""),
                    "score": latest_attempt.get("score"),
                    "timestamp": latest_attempt.get("timestamp"),
                    "questions": quiz["data"].get("questions"),
                    "userAnswers": latest_attempt.get("userAnswers"),
                    "tags": study_plan["data"]["tags"]
                })
            except Exception as e:
                print(f"Error retrieving quiz {quiz_id}: {str(e)}")
                continue

        updated_plan_json = update_study_plan(
            original_plan=study_plan["data"]["content"],
            quiz_results=quiz_results
        )
        updated_plan_data = json.loads(updated_plan_json)

        study_plan["data"]["content"] = updated_plan_data
        study_plan["data"]["updatedAt"] = datetime.utcnow().isoformat()

        container.upsert_item(body=study_plan)

        return {"id": plan_id, "message": "Study plan updated successfully", "updatedPlan": updated_plan_data}
    except Exception as e:
        print(f"Error updating study plan: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update study plan: {str(e)}")

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
            print(f"📄 File received: {file.filename}, type: {file.content_type}")
            allowed_content_types = ["application/pdf", "text/plain"]
            if file.content_type not in allowed_content_types:
                raise HTTPException(status_code=400, detail="Invalid file type.")

            file_location = f"temp_{file.filename}"
            with open(file_location, "wb") as f:
                content = await file.read()
                f.write(content)

            if file.content_type == "application/pdf":
                print("📚 Extracting text from PDF...")
                extracted_text = extract_text_from_pdf(file_location)
            else:
                print("📄 Reading plain text file...")
                with open(file_location, "r", encoding="utf-8") as text_file:
                    extracted_text = text_file.read()

            os.remove(file_location)

        else:
            print("📝 Text received in body")
            extracted_text = text

        print("✨ Sending to Azure for summarization...")
        summary = summarize_text(extracted_text)
        print("✅ Summary received")

    except Exception as e:
        print(f"❌ Error during processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"summary": summary}

# --------------------------------------------------------------------------------------
# Dev server
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    # 0.0.0.0 so your Vite dev server can reach FastAPI
    uvicorn.run(app, host="0.0.0.0", port=8000)
