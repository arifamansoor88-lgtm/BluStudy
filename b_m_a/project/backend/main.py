import os
import json
import uuid
import uvicorn
import base64
import mimetypes
import shutil
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from json_repair import repair_json
from dotenv import load_dotenv
import msal
from jose import jwt
from fastapi import (
    FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, Body, Request
)
try:
    from fastapi import StreamingResponse, RedirectResponse, JSONResponse, FileResponse
except ImportError:
    from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from database import client, container
from pdf_utils import extract_text_from_pdf
from openai_client import generate_quiz, generate_answer_explanation, evaluate_short_answer, generate_study_plan, update_study_plan, summarize_text, generate_flashcard as openai_generate_flashcard, analyze_quiz_performance
from models import QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse, QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest, UpdateStudyPlanResponse, Flashcard, FlashcardDeck, FlashcardDocument, MindmapDocument, SaveMindmapResponse 
from pydantic import BaseModel
from azure.cosmos.exceptions import CosmosResourceNotFoundError
import time

# Load the environment variables
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

# Static mount for local storage fallback
os.makedirs("static/audio", exist_ok=True)
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

COSMOS_URL = os.getenv("COSMOS_DB_URL") or os.getenv("COSMOS_URL") or os.getenv("COSMOS_ENDPOINT")
COSMOS_KEY = os.getenv("COSMOS_DB_KEY") or os.getenv("COSMOS_KEY")
COSMOS_DB_NAME = os.getenv("COSMOS_DB_NAME", "notes-db")
COSMOS_CONTAINER_NAME = os.getenv("COSMOS_CONTAINER_NAME", "voice-notes")
COSMOS_PARTITION_KEY_PATH = os.getenv("COSMOS_PARTITION_KEY_PATH", "/userId")

STORAGE_MODE = "cosmos" if (COSMOS_URL and COSMOS_KEY) else "local"

# ---------- Local JSON store ----------
class LocalContainer:
    def __init__(self, root_dir: str):
        self.root = root_dir
        os.makedirs(self.root, exist_ok=True)
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
                pk_value = it.get("userId") or it.get("user_id")
                if partition_key is not None and pk_value is not None and pk_value != partition_key:
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

    def upsert_item(self, body: Dict[str, Any]):
        items = self._load()
        item_id = body.get("id")
        for idx, it in enumerate(items):
            if it.get("id") == item_id:
                items[idx] = body
                self._save(items)
                return body
        items.append(body)
        self._save(items)
        return body

    def delete_item(self, item: str, partition_key: Optional[str] = None):
        items = self._load()
        new_items = []
        found = False
        for it in items:
            if it.get("id") == item:
                pk_value = it.get("userId") or it.get("user_id")
                if partition_key is not None and pk_value is not None and pk_value != partition_key:
                    new_items.append(it)
                else:
                    found = True
            else:
                new_items.append(it)
        if not found:
            raise HTTPException(status_code=404, detail="Item not found")
        self._save(new_items)
        return {"message": "deleted"}

    def query_items(self, query: str, parameters: Optional[List[Dict[str, Any]]] = None, enable_cross_partition_query: bool = True):
        items = self._load()
        params = {p["name"]: p["value"] for p in (parameters or [])}
        q = query.replace("\n", " ").strip().lower()

        def contains_ci(hay: Optional[str], needle: str) -> bool:
            return hay is not None and needle in hay.lower()

        if "from c where c.user_id = @user_id" in q:
            user_id = params.get("@user_id")
            filtered = [self._ensure_defaults(it) for it in items if it.get("user_id") == user_id]
            if "and c.folder = @folder" in q:
                folder = params.get("@folder")
                filtered = [it for it in filtered if it.get("folder") == folder]
            return filtered

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

        if "from c where c.userid = @userid and c.contenttype = 'quiz'" in q:
            # Support both @userid and @userId parameter names (query is lowercased, so @userId becomes @userid)
            user_id = params.get("@userid") or params.get("@userId")

            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType", "").lower() == "quiz" or it.get("contenttype", "").lower() == "quiz")
            ]
            filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
            return filtered

        if "from c where c.userid = '" in q and "and c.contenttype = 'study_plan'" in q:
            try:
                start = q.index("c.userid = '") + len("c.userid = '")
                end = q.index("'", start)
                uid_inline = query[start:end]
            except Exception:
                uid_inline = None
            filtered = [it for it in items if (it.get("userId") == uid_inline and it.get("contentType") == "study_plan")]
            filtered.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            return filtered

        # Handle voice notes query: "WHERE c.userId = @uid AND c.contentType = 'voice_note'"
        if "from c where c.userid = @uid and c.contenttype = 'voice_note'" in q:
            user_id = params.get("@uid")
            # Support both userId and user_id 
            filtered = [
                self._ensure_defaults(it) for it in items 
                if (it.get("userId") == user_id or it.get("user_id") == user_id) 
                and it.get("contentType") == "voice_note"
            ]
            return filtered

        # Handle query by ID: "WHERE c.id = @id" (for finding notes across users)
        if "from c where c.id = @id" in q:
            item_id = params.get("@id")
            filtered = [it for it in items if it.get("id") == item_id]
            return filtered

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
        container = _database.get_container_client(COSMOS_CONTAINER_NAME)
        list(container.query_items(query="SELECT TOP 1 * FROM c", enable_cross_partition_query=True))
    except Exception as e:
        cosmos_error = str(e)
        storage_mode = "local"
        container = LocalContainer("./_localdb")
else:
    container = LocalContainer("./_localdb")

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
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
    item.setdefault("timestamp", datetime.utcnow().isoformat())
    if "audioUrl" in item and "audio_url" not in item:
        item["audio_url"] = item.pop("audioUrl")
    item.setdefault("audio_url", None)
    item["tags"] = _normalize_tags(item.get("tags", []))
    item.setdefault("settings", {})
    return item

_ensure_defaults = _ensure_note_defaults

def _attach_playback_urls(item: Dict[str, Any], request: Request) -> Dict[str, Any]:
    base_url = str(request.base_url).rstrip("/")
    owner = item.get("userId") or item.get("user_id") or "default"
    playback_url = f"{base_url}/voice-notes/{item['id']}/audio?user_id={owner}"
    item["playback_url"] = playback_url
    item["audio_url"] = playback_url
    item["audioUrl"] = playback_url
    return item

# --------------------------------------------------------------------------------------
# Azure Blob helper
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
# Auth
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication failed: {e}")

# ---------------------------
# Dev token endpoint (Swagger helper)
# ---------------------------
@app.post("/token")
async def dev_issue_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    DEV ONLY: Issues a dummy JWT so Swagger `/docs` can call protected endpoints.
    Username becomes the `sub` (prefixed) so your Cosmos partition key is stable.
    Password is ignored.
    """
    username = (form_data.username or "devuser").strip().lower()

    # Deterministic user id/partition key
    sub = f"dev-{username}"

    now = int(time.time())
    payload = {
        "sub": sub,
        "name": username.split("@")[0] if "@" in username else username,
        "preferred_username": username,
        "emails": [username] if "@" in username else [],
        "iat": now,
        "exp": now + 3600,  # 1 hour
    }

    # Same dummy key you reference in validate_token
    token = jwt.encode(
        payload,
        key="development_key_not_for_production",
        algorithm="HS256",
    )

    return {"access_token": token, "token_type": "bearer"}



# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"message": "Backend is running", "storage": storage_mode, "cosmos_error": cosmos_error}

@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools_config():
    """Handle Chrome DevTools automatic request to suppress 404 errors"""
    from starlette.responses import Response
    return Response(status_code=204)

@app.get("/health")
def health_check():
    try:
        query = "SELECT VALUE COUNT(1) FROM c"
        result = list(container.query_items(query=query, enable_cross_partition_query=True))
        db_status = "connected"
        db_count = result[0] if result else 0
    except Exception as db_error:
        db_status = f"error: {str(db_error)}"
        db_count = 0

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

# ----- Voice Notes -----
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
    note_id = str(uuid.uuid4())

    try:
        file_bytes = await audio.read()
    finally:
        await audio.close()

    filename = audio.filename or f"{note_id}.webm"
    content_type = _guess_content_type(filename)

    # Store audio
    audio_blob_url = None
    audio_inline_b64 = None
    audio_local_path = None

    if STORAGE_BACKEND == "azure_blob":
        blob_name = f"{note_id}{os.path.splitext(filename)[1] or ''}"
        audio_blob_url = _upload_to_azure_blob(file_bytes, blob_name, content_type)
    elif STORAGE_BACKEND == "cosmos_inline":
        audio_inline_b64 = base64.b64encode(file_bytes).decode("ascii")
    elif STORAGE_BACKEND == "local":
        ext = os.path.splitext(filename)[1] or ".webm"
        audio_dir = os.path.join("static", "audio")
        os.makedirs(audio_dir, exist_ok=True)
        audio_local_path = os.path.join(audio_dir, f"{note_id}{ext}")
        with open(audio_local_path, "wb") as f:
            f.write(file_bytes)
    else:
        raise HTTPException(status_code=500, detail="Invalid STORAGE_BACKEND. Use 'azure_blob', 'cosmos_inline', or 'local'.")

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
        "timestamp": datetime.utcnow().isoformat(),
        "settings": {},
        "audio_url": playback_url,
        "audio_blob_url": audio_blob_url,
        "audio_inline_b64": audio_inline_b64,
        "audio_filename": filename,
        "audio_content_type": content_type,
        "audio_local_path": audio_local_path
    }

    container.create_item(body=item)
    item = _ensure_note_defaults(item)
    item = _attach_playback_urls(item, request)
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

    allowed = {"title", "text", "tags", "duration", "visibility", "settings", "timestamp"}
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
    item["userId"] = uid
    item["id"] = note_id
    base_url = str(request.base_url).rstrip("/")
    item["audio_url"] = f"{base_url}/voice-notes/{note_id}/audio?user_id={uid}"

    container.upsert_item(body=item)
    item = _ensure_note_defaults(item)
    item = _attach_playback_urls(item, request)
    return item

@app.delete("/voice-notes/{note_id}")
async def delete_voice_note(note_id: str, request: Request, user_id: Optional[str] = Query(None)):
    uid = _resolve_user_id(request, user_id_q=user_id)
    existing = None
    
    # Try to find the note with current user_id first
    try:
        existing = container.read_item(item=note_id, partition_key=uid)
    except Exception:
        pass
    
    # If not found, search across all items using query (works for both local and Cosmos)
    if not existing:
        # Use cross-partition query to find note by ID
        q = "SELECT * FROM c WHERE c.id = @id"
        res = list(container.query_items(
            query=q,
            parameters=[{"name": "@id", "value": note_id}],
            enable_cross_partition_query=True
        ))
        # Filter for voice notes
        for item in res:
            if item.get("contentType") == "voice_note":
                existing = item
                break
    
    if not existing or existing.get("contentType") != "voice_note":
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Use the note's actual user_id (NOT LOCAL STORAGE WHICH WAS THE ISSUE BEFORE)
    actual_uid = existing.get("userId") or existing.get("user_id") or uid
    
    # Delete audio file if using local storage
    if STORAGE_BACKEND == "local" and existing.get("audio_local_path"):
        try:
            os.remove(existing["audio_local_path"])
        except Exception:
            pass
    
    # Delete using the note's actual user_id
    try:
        container.delete_item(item=note_id, partition_key=actual_uid)
    except Exception:
        # If partition key check fails, try with None (allows deletion even if user_id changed)
        # This is safe because we already verified it's a voice_n0te 
        try:
            container.delete_item(item=note_id, partition_key=None)
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

def _stream_inline_audio(item: Dict[str, Any]) -> StreamingResponse:
    b64 = item.get("audio_inline_b64")
    if not b64:
        raise HTTPException(status_code=404, detail="Inline audio not present")
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupt inline audio")
    ctype = item.get("audio_content_type") or _guess_content_type(item.get("audio_filename"))
    async def generate():
        chunk_size = 65536  
        for i in range(0, len(raw), chunk_size):
            yield raw[i:i + chunk_size]
    return StreamingResponse(generate(), media_type=ctype)

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

    if item.get("audio_inline_b64"):
        return _stream_inline_audio(item)

    if STORAGE_BACKEND == "local" and item.get("audio_local_path"):
        file_path = item["audio_local_path"]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        relative_path = os.path.relpath(file_path, "static")
        base_url = str(request.base_url).rstrip("/")
        static_url = f"{base_url}/static/{relative_path.replace(os.sep, '/')}"
        return RedirectResponse(url=static_url, status_code=307)

    blob = (item.get("audio_blob_url") or "").strip()
    if blob.startswith("http://") or blob.startswith("https://"):
        return RedirectResponse(url=blob, status_code=307)

    raise HTTPException(status_code=404, detail="Audio location not found")

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

# ----- Quizzes -----
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
        file_path = f"./temp_{file.filename}"
        try:
            with open(file_path, "wb") as f:
                f.write(await file.read())
            text = extract_text_from_pdf(file_path)
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

        try:
            formats_dict = json.loads(question_formats)
        except json.JSONDecodeError:
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
        quiz_id = str(uuid.uuid4())
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

        container.create_item(body=quiz_document)
        quiz_data["id"] = quiz_document["id"]
        print(f"Quiz generated and saved with ID: {quiz_id}")
        return quiz_data
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate quiz: {str(e)}")


@app.post("/generate-quiz-from-topic")
async def create_quiz_from_topic(
    payload: Dict[str, Any],
    user_claims: dict = Depends(validate_token),
):
    """
    Generate and save a quiz based on a plain topic/chapter/concept string,
    reusing the existing Azure OpenAI quiz generation logic.
    """
    try:
        print(f"Generating topic-based quiz for user: {user_claims['sub']}")
        topic: str = (payload.get("topic") or "").strip()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Topic is required",
            )

        num_questions = payload.get("num_questions") or 10
        try:
            num_questions = int(num_questions)
        except Exception:
            num_questions = 10
        num_questions = max(10, min(40, num_questions))

        focus_topics = payload.get("focus_topics") or ""
        question_formats_payload = payload.get("question_formats") or {}
        if isinstance(question_formats_payload, dict):
            formats_dict = {
                k: bool(v) for k, v in question_formats_payload.items() if bool(v)
            }
        else:
            formats_dict = {
                "multiple_choice": True,
                "multi_select": True,
                "drag_and_drop": True,
            }

        selected_formats = [fmt for fmt, selected in formats_dict.items() if selected]
        if not selected_formats:
            selected_formats = ["multiple_choice"]

        # Use the topic string as synthetic "text" input for the quiz generator
        synthetic_text = f"Create a quiz for the following topic/chapter/concept:\n\n{topic}"

        quiz_json = generate_quiz(
            text=synthetic_text,
            num_questions=num_questions,
            focus_topics=focus_topics.strip(),
            question_formats=selected_formats,
        )

        quiz_data = json.loads(quiz_json)
        quiz_id = str(uuid.uuid4())
        quiz_document = {
            "id": quiz_id,
            "userId": user_claims["sub"],
            "contentType": "quiz",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": quiz_data.get("quiz_title", topic or "Generated Quiz"),
                "questions": quiz_data.get("questions", []),
                "userAnswers": None,
                "score": None,
                "timeTaken": 0,
                "resourceName": topic,
                "options": {
                    "numQuestions": num_questions,
                    "selectedTopics": (focus_topics.split(",") if focus_topics else []),
                    "customTopics": focus_topics,
                    "questionFormats": formats_dict,
                },
                "attempts": [],
            },
        }

        container.create_item(body=quiz_document)
        quiz_data["id"] = quiz_document["id"]
        print(f"Topic-based quiz generated and saved with ID: {quiz_id}")
        return quiz_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating topic-based quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate topic-based quiz: {str(e)}",
        )

@app.post("/save-quiz", response_model=SavedQuizResponse)
async def save_quiz(quiz: QuizDocument, user_claims: dict = Depends(validate_token)):
    try:
        print(f"Saving quiz for user: {user_claims['sub']}")
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz.data.dict()
        }
        container.create_item(body=document)
        print(f"Quiz saved successfully with ID: {document['id']}")
        return {"id": document["id"], "message": "Quiz saved successfully"}
    except Exception as e:
        print(f"Error saving quiz: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save quiz: {str(e)}")

@app.post("/save-quiz-attempt", response_model=SaveQuizAttemptResponse)
async def save_quiz_attempt(attempt: SaveQuizAttemptRequest, user_claims: dict = Depends(validate_token)):
    try:
        quiz_id = attempt.quizId
        try:
            quiz = container.read_item(item=quiz_id, partition_key=user_claims["sub"])
            if quiz["userId"] != user_claims["sub"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        except Exception:
            print(f"Error retrieving quiz: {quiz_id}")
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
        print(f"Quiz attempt saved for quiz ID: {quiz_id}, attempt ID: {attempt_id}")
        return {"quizId": quiz_id, "attemptId": attempt_id, "message": "Quiz attempt saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving quiz attempt: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save quiz attempt: {str(e)}")

@app.get("/quizzes")
async def get_quizzes(user_claims: dict = Depends(validate_token)):
    try:
        print(f"Fetching quizzes for user: {user_claims['sub']}")
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'quiz' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        print(f"Found {len(items)} quizzes for user")
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

# ----- Study Plans -----
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
        print(f"Study plan created with ID: {study_plan_document['id']}")
        return {"id": study_plan_document["id"], "plan": study_plan_data, "message": "Study plan created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating study plan: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate study plan: {str(e)}")

@app.get("/study-plans")
async def get_study_plans(user_claims: dict = Depends(validate_token)):
    try:
        print(f"Fetching study plans for user: {user_claims['sub']}")
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
        print(f"Found {len(study_plans)} study plans for user")
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
        except Exception:
            print(f"Error retrieving study plan: {plan_id}")
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
                    "title": quiz.get("data", {}).get("title", ""),
                    "score": latest_attempt.get("score"),
                    "timestamp": latest_attempt.get("timestamp"),
                    "questions": quiz.get("data", {}).get("questions"),
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
        print(f"Study plan updated with ID: {plan_id}")
        return {"id": plan_id, "message": "Study plan updated successfully", "updatedPlan": updated_plan_data}
    except Exception as e:
        print(f"Error updating study plan: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update study plan: {str(e)}")

# ----- Explanations and Evaluations -----
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

# ----- Summarize -----
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
        print(f"❌ Error during processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ----- Quiz Performance Analysis -----
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
        analysis_result = await analyze_quiz_performance(
            request.questions,
            request.userAnswers,
            request.quizMetadata
        )
        def _normalize_topic_list(items: Any) -> List[Dict[str, Any]]:
            if not isinstance(items, list):
                return []
            normalized: List[Dict[str, Any]] = []
            for item in items:
                if isinstance(item, dict):
                    normalized.append(item)
                elif isinstance(item, str):
                    normalized.append(
                        {
                            "name": item,
                            "questionIndices": [],
                            "correctCount": 0,
                            "totalCount": 0,
                            "accuracy": 0,
                            "difficulty": "unknown",
                            "category": "general",
                            "keywords": [],
                            "reason": f"Topic identified: {item}",
                            "suggestions": [f"Review {item}", f"Practice {item}"],
                        }
                    )
            return normalized

        analysis_result = analysis_result or {}
        analysis_result.setdefault("topics", [])
        analysis_result["weakTopics"] = _normalize_topic_list(
            analysis_result.get("weakTopics", [])
        )
        analysis_result["strongTopics"] = _normalize_topic_list(
            analysis_result.get("strongTopics", [])
        )

        return analysis_result
    except Exception as e:
        print(f"Error in analyze-quiz-performance endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing quiz performance: {str(e)}"
        )


# Save flashcard endpoint - protected 
@app.post("/save-flashcard", response_model=dict)
async def save_flashcard(flashcard: FlashcardDocument, user_claims: dict = Depends(validate_token)):
    try:
        # Prepare document for Cosmos DB
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": "flashcard_deck",
            "createdAt": datetime.utcnow().isoformat(),
            "title": flashcard.data.title,
            "cards": flashcard.data.cards
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
        query = """
        SELECT c.id, c.title, ARRAY_LENGTH(c.cards) AS cardCount, c.createdAt
        FROM c
        WHERE c.userId = @userId
        AND c.contentType = 'flashcard_deck'
        ORDER BY c.createdAt DESC
        """

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
        deck = container.read_item(
            item=deck_id, 
            partition_key=user_claims["sub"]
        )
        
        # Verify the deck belongs to the user
        if deck["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access denied"
            )
            
        return deck
    except Exception as e:
        print(f"Error fetching deck: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Deck not found"
        )

# Delete flashcard deck endpoint - protected
@app.delete("/delete-deck/{deck_id}", response_model=dict)
async def delete_deck(deck_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the deck from Cosmos DB
        deck = container.read_item(
            item=deck_id,
            partition_key=user_claims["sub"]
        )

        # Verify the deck belongs to the user
        if deck["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Delete the deck from Cosmos DB
        container.delete_item(
            item=deck_id,
            partition_key=user_claims["sub"]
        )

        return {"message": "Flashcard deck deleted successfully"}

    except Exception as e:
        print(f"Error deleting deck: {str(e)}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deck not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete deck: {str(e)}"
        )

# PDF upload and flashcard generation endpoint - protected
@app.post("/generate-flashcard")
async def generate_flashcard(
    file: UploadFile = File(...),
    num_cards: int = Form(10),
    user_claims: dict = Depends(validate_token)
):
    print(f"Generating flashcards for user: {user_claims['sub']}")

    if not file or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(422, "Please upload a PDF")

    file_path = f"./temp_{uuid.uuid4()}.pdf"
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())

        extracted_text = extract_text_from_pdf(file_path)

        if len(extracted_text.strip()) < 200:
            raise HTTPException(422, "PDF has insufficient readable text")

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    raw = openai_generate_flashcard(extracted_text, num_cards)
    print("RAW LLM RESPONSE:", repr(raw))

    def sanitize_llm_json(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
        return text.strip()

    try:
        clean = sanitize_llm_json(raw)
        deck = json.loads(clean)
    except Exception as e:
        raise HTTPException(500, f"Invalid LLM output: {str(e)}")

    deck_id = str(uuid.uuid4())

    document = {
        "id": deck_id,
        "userId": user_claims["sub"],
        "contentType": "flashcard_deck",
        "createdAt": datetime.utcnow().isoformat(),
        "title": deck.get("title", "Generated Deck"),
        "cards": deck["cards"],
        "resourceName": file.filename
    }

    container.create_item(body=document)

    return {
        "deckId": deck_id,
        "cardCount": len(deck["cards"]),
        "message": "Flashcard deck created"
    }


@app.get("/flashcards")
async def get_flashcards(user_claims: dict = Depends(validate_token)):
    try:
        print(f"Fetching flashcards for user: {user_claims['sub']}")
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'flashcard' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        print(f"Found {len(items)} flashcards for user")
        return items
    except Exception as e:
        print(f"Error fetching flashcards: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch flashcards: {str(e)}")

# Mindmap API Endpoints

# Save mindmap endpoint - protected
@app.post("/save-mindmap", response_model=SaveMindmapResponse)
async def save_mindmap(mindmap: MindmapDocument, user_claims: dict = Depends(validate_token)):
    try:
        # Prepare document for Cosmos DB
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],  
            "contentType": mindmap.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": mindmap.data.dict()  
        }
        
        # Save to Cosmos DB
        container.create_item(body=document)
        return {"id": document["id"], "message": "Mindmap saved successfully"}
    except Exception as e:
        print(f"Error saving mindmap: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save mindmap: {str(e)}"
        )

# Update mindmap endpoint - protected
@app.put("/update-mindmap/{mindmap_id}", response_model=SaveMindmapResponse)
async def update_mindmap(mindmap_id: str, mindmap: MindmapDocument, user_claims: dict = Depends(validate_token)):
    try:
        # First, retrieve the existing mindmap
        try:
            existing_mindmap = container.read_item(
                item=mindmap_id,
                partition_key=user_claims["sub"]
            )
            
            # Verify the mindmap belongs to the user
            if existing_mindmap["userId"] != user_claims["sub"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        except Exception as e:
            print(f"Error retrieving mindmap: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mindmap not found"
            )
        
        # Update the mindmap document
        existing_mindmap["data"] = mindmap.data.dict()
        existing_mindmap["updatedAt"] = datetime.utcnow().isoformat()
        
        # Save to Cosmos DB
        try:
            container.replace_item(
                item=mindmap_id,
                body=existing_mindmap
            )
            return {"id": mindmap_id, "message": "Mindmap updated successfully"}
        except Exception as db_error:
            print(f"Database error updating mindmap: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update mindmap in database: {str(db_error)}"
            )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error updating mindmap: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update mindmap: {str(e)}"
        )

# Get all mindmaps for a user - protected
@app.get("/mindmaps")
async def get_mindmaps(user_claims: dict = Depends(validate_token)):
    try:
        # Query parameters for Cosmos DB
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'mindmap' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        
        # Query Cosmos DB
        try:
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            return items
        except Exception as db_error:
            print(f"Database error fetching mindmaps: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch mindmaps from database: {str(db_error)}"
            )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error fetching mindmaps: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch mindmaps: {str(e)}"
        )

# Get a specific mindmap by ID - protected
@app.get("/mindmaps/{mindmap_id}")
async def get_mindmap(mindmap_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the mindmap from Cosmos DB (using partition key)
        mindmap = container.read_item(
            item=mindmap_id,
            partition_key=user_claims["sub"]
        )
        
        # Verify the mindmap belongs to the user
        if mindmap["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        return mindmap
    except Exception as e:
        print(f"Error fetching mindmap: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found"
        )

# Delete mindmap endpoint - protected
@app.delete("/delete-mindmap/{mindmap_id}", response_model=dict)
async def delete_mindmap(mindmap_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the mindmap from Cosmos DB
        mindmap = container.read_item(
            item=mindmap_id,
            partition_key=user_claims["sub"]
        )

        # Verify the mindmap belongs to the user
        if mindmap["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Delete the mindmap from Cosmos DB
        container.delete_item(
            item=mindmap_id,
            partition_key=user_claims["sub"]
        )

        return {"message": "Mindmap deleted successfully"}

    except Exception as e:
        print(f"Error deleting mindmap: {str(e)}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mindmap not found"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete mindmap: {str(e)}"
        )



# --------------------------------------------------------------------------------------
# Dev server
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)