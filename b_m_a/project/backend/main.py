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
from models import QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse, QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest, UpdateStudyPlanResponse, Flashcard, FlashcardDeck, FlashcardDocument, MindmapDocument, SaveMindmapResponse, CreateMindmapRequest, CreateFolderRequest, UpdateFolderRequest, FolderOut 
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
        # Lowercase parameter names to handle case variations (e.g., @userId vs @userid)
        params = {p["name"].lower(): p["value"] for p in (parameters or [])}
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
            user_id = params.get("@userid")

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

        # Handle folder items query: "WHERE c.userId = @userId AND c.folderId = @folderId"
        if "from c where c.userid = @userid and c.folderid = @folderid" in q:
            user_id = params.get("@userid")
            folder_id = params.get("@folderid")
            
            filtered = [
                it for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and it.get("folderId") == folder_id
            ]
            
            # Add content type filter if present
            if "and c.contenttype = @contenttype" in q:
                content_type = params.get("@contenttype")
                filtered = [it for it in filtered if (it.get("contentType", "").lower() == content_type.lower() or it.get("contenttype", "").lower() == content_type.lower())]
            
            # Sort by createdAt if present
            filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
            return filtered

        # Handle folder query: "WHERE c.userId = @userId AND c.contentType = 'folder'"
        if "from c where c.userid = @userid and c.contenttype = 'folder'" in q:
            user_id = params.get("@userid")
            filtered = [
                it for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType", "").lower() == "folder" or it.get("contenttype", "").lower() == "folder")
            ]
            filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
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
#        cosmos_client = CosmosClient(os.getenv("COSMOS_DB_URL"), credential=os.getenv("COSMOS_DB_KEY"))
        _database = cosmos_client.get_database_client("ai-education-platform-db")
        container = _database.get_container_client("userContent")
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

# ----- Recents -----
@app.get("/api/recents")
async def get_recent_items(
    request: Request,
    limit: int = Query(8, ge=1, le=50),
):
    """Get recently accessed/created items for the authenticated user"""
    # Try to get user ID from multiple sources
    uid = request.headers.get("X-User-Id")
    
    if not uid:
        # Try to extract from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                # Try to decode JWT without verification (for user ID extraction only)
                from jwt import decode as jwt_decode
                claims = jwt_decode(token, options={"verify_signature": False})
                uid = claims.get("sub") or claims.get("oid") or claims.get("userId")
            except Exception as e:
                print(f"DEBUG: Could not decode token: {e}")
                uid = None
    
    uid = uid or _resolve_user_id(request) or "default"
    print(f"DEBUG: /api/recents called with uid={uid}")
    
    try:
        # Query all items for this user, ordered by most recent
        # Some items might not have createdAt, so we'll handle both cases
        query = "SELECT * FROM c WHERE c.userId = @uid"
        params = [{"name": "@uid", "value": uid}]
        
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        print(f"DEBUG: Found {len(items)} items for user {uid}")
        
        # Sort by createdAt or updatedAt in Python (some items might not have these fields)
        items.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
        
        # Limit results
        items = items[:limit]
        
        # Format results to include relevant fields
        result_items = []
        for item in items:
            result_items.append({
                "id": item.get("id"),
                "title": item.get("title", "Untitled"),
                "contentType": item.get("contentType", "unknown"),
                "createdAt": item.get("createdAt"),
                "updatedAt": item.get("updatedAt"),
            })
        
        return {"items": result_items}
    except Exception as e:
        print(f"DEBUG: Error in /api/recents: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"items": [], "error": str(e)}

# ----- Track Tool Access -----
@app.post("/api/track-access")
async def track_tool_access(
    request: Request,
    item_id: str = Body(...),
):
    """Track when a user accesses/opens a tool to keep recents updated"""
    uid = _resolve_user_id(request)
    
    try:
        # Try to get the item first
        query = "SELECT * FROM c WHERE c.id = @id"
        params = [{"name": "@id", "value": item_id}]
        
        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))
        
        if not items:
            return {"success": False, "error": "Item not found"}
        
        item = items[0]
        
        # Update the updatedAt timestamp
        item["updatedAt"] = datetime.utcnow().isoformat()
        
        # Upsert the item back to the database
        container.upsert_item(item)
        
        print(f"DEBUG: Tracked access to item {item_id} for user {uid}")
        return {"success": True, "message": "Access tracked"}
    except Exception as e:
        print(f"DEBUG: Error in track-access: {str(e)}")
        return {"success": False, "error": str(e)}

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
    folder_id: Optional[str] = Form(None),
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
    
    # Add folderId if provided
    if folder_id:
        item["folderId"] = folder_id

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
    folder_id: Optional[str] = Form(None),
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
        
        # Add folderId if provided
        if folder_id:
            quiz_document["folderId"] = folder_id

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
        
        # Add folderId if provided
        folder_id = payload.get("folder_id") or payload.get("folderId")
        if folder_id:
            quiz_document["folderId"] = folder_id

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
async def save_quiz(
    quiz: QuizDocument,
    folder_id: Optional[str] = Body(None),
    user_claims: dict = Depends(validate_token)
):
    try:
        print(f"Saving quiz for user: {user_claims['sub']}")
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz.data.dict()
        }
        
        # Add folderId if provided
        if folder_id:
            document["folderId"] = folder_id
        
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
    folder_id: Optional[str] = Form(None),
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
        
        # Add folderId if provided
        if folder_id:
            study_plan_document["folderId"] = folder_id

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

# ----- Save Summary to Folder -----
class SaveSummaryRequest(BaseModel):
    title: str
    description: Optional[str] = None
    contentType: str = "summary"
    folderId: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

@app.post("/save-summary")
async def save_summary(
    request: SaveSummaryRequest,
    user_claims: dict = Depends(validate_token)
):
    try:
        user_id = user_claims.get("oid") or user_claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        summary_id = str(uuid.uuid4())
        document = {
            "id": summary_id,
            "userId": user_id,
            "title": request.title,
            "description": request.description or "",
            "contentType": "summary",
            "data": request.data or {},
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }
        
        # Add folderId if provided
        if request.folderId:
            document["folderId"] = request.folderId
        
        container.create_item(body=document)
        print(f"Summary saved with ID: {summary_id}")
        return {"id": summary_id, "message": "Summary saved successfully"}
    except Exception as e:
        print(f"Error saving summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save summary: {str(e)}")

@app.get("/summaries")
async def get_summaries(user_claims: dict = Depends(validate_token)):
    try:
        user_id = user_claims.get("oid") or user_claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        print(f"Fetching summaries for user: {user_id}")
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'summary' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_id}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        print(f"Found {len(items)} summaries for user")
        return items
    except Exception as e:
        print(f"Error fetching summaries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch summaries: {str(e)}")

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
async def save_flashcard(
    flashcard: FlashcardDocument,
    folder_id: Optional[str] = Body(None),
    user_claims: dict = Depends(validate_token)
):
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
        
        # Add folderId if provided
        if folder_id:
            document["folderId"] = folder_id
        
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
    
class TopicFlashcardRequest(BaseModel):
    topic: str
    num_cards: int = 10
    folder_id: Optional[str] = None

@app.post("/generate-flashcard-topic")
async def generate_flashcard_from_topic(
    payload: TopicFlashcardRequest,
    user_claims: dict = Depends(validate_token)
):
    topic = payload.topic.strip()

    if len(topic) < 5:
        raise HTTPException(422, "Topic is too short")

    # 🔹 Prompt engineering — IMPORTANT
    prompt = f"""
You are an expert tutor.

Generate a flashcard deck for the following topic:
"{topic}"

Rules:
- Output VALID JSON ONLY
- No markdown
- No commentary
- Structure:

{{
  "title": "<concise deck title>",
  "cards": [
    {{
      "question": "...",
      "answer": "...",
      "difficulty": "easy|medium|hard",
      "important": false
    }}
  ]
}}

Generate exactly {payload.num_cards} cards.
"""

    raw = openai_generate_flashcard(prompt, payload.num_cards)
    print("RAW LLM RESPONSE:", repr(raw))

    try:
        deck = json.loads(raw)
    except Exception as e:
        raise HTTPException(500, f"Invalid LLM output: {str(e)}")

    deck_id = str(uuid.uuid4())

    document = {
        "id": deck_id,
        "userId": user_claims["sub"],
        "contentType": "flashcard_deck",
        "createdAt": datetime.utcnow().isoformat(),
        "title": deck.get("title", topic),
        "cards": deck["cards"],
        "resourceName": "topic"
    }

    if payload.folder_id:
        document["folderId"] = payload.folder_id

    container.create_item(body=document)

    return {
        "deckId": deck_id,
        "cardCount": len(deck["cards"]),
        "message": "Flashcard deck created from topic"
    }

# PDF upload and flashcard generation endpoint - protected
@app.post("/generate-flashcard")
async def generate_flashcard(
    file: UploadFile = File(...),
    num_cards: int = Form(10),
    folder_id: Optional[str] = Form(None),
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
    
    # Add folderId if provided
    if folder_id:
        document["folderId"] = folder_id

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

def generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from a title"""
    import re
    # Convert to lowercase and replace spaces with hyphens
    slug = title.lower().strip()
    # Remove special characters
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    # Replace multiple spaces/hyphens with single hyphen
    slug = re.sub(r'[\s-]+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    # Add random suffix to ensure uniqueness
    import random
    import string
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{slug}-{suffix}"

# Create mindmap endpoint - protected
@app.post("/create-mindmap", response_model=SaveMindmapResponse)
async def create_mindmap(request: CreateMindmapRequest, user_claims: dict = Depends(validate_token)):
    """Create a new mindmap with just a title and generate a unique slug"""
    try:
        # Generate unique slug
        slug = generate_slug(request.title)
        
        # Create initial mindmap document
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": "mindmap",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": request.title,
                "slug": slug,
                "nodes": [],
                "edges": [],
                "groups": [],
                "metadata": {}
            }
        }
        
        # Save to Cosmos DB
        container.create_item(body=document)
        return {"id": document["id"], "slug": slug, "message": "Mindmap created successfully"}
    except Exception as e:
        print(f"Error creating mindmap: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mindmap: {str(e)}"
        )

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
        
        # Generate slug if not provided
        if not document["data"].get("slug"):
            document["data"]["slug"] = generate_slug(document["data"]["title"])
        
        # Save to Cosmos DB
        container.create_item(body=document)
        return {"id": document["id"], "slug": document["data"]["slug"], "message": "Mindmap saved successfully"}
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
            slug = existing_mindmap["data"].get("slug", "")
            return {"id": mindmap_id, "slug": slug, "message": "Mindmap updated successfully"}
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

# Get a specific mindmap by ID or slug - protected
@app.get("/mindmaps/{mindmap_id}")
async def get_mindmap(mindmap_id: str, user_claims: dict = Depends(validate_token)):
    try:
        mindmap = None
        
        # First, try to get by ID directly
        try:
            mindmap = container.read_item(
                item=mindmap_id,
                partition_key=user_claims["sub"]
            )
        except Exception:
            # ID lookup failed, try slug lookup
            pass
        
        # If ID lookup failed, try finding by slug
        if not mindmap:
            query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'mindmap' AND c.data.slug = @slug"
            parameters = [
                {"name": "@userId", "value": user_claims["sub"]},
                {"name": "@slug", "value": mindmap_id}
            ]
            
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if items:
                mindmap = items[0]
        
        # If still not found, raise error
        if not mindmap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mindmap not found"
            )
        
        # Verify the mindmap belongs to the user
        if mindmap["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        return mindmap
    except HTTPException:
        raise
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
# Folder API Endpoints
# --------------------------------------------------------------------------------------

def _calculate_folder_depth(folder_id: str, user_id: str, visited: Optional[set] = None) -> int:
    """Calculate the depth of a folder by traversing parentFolderId chain. Returns depth (0 = root level)."""
    if visited is None:
        visited = set()
    
    if folder_id in visited:
        # Circular reference detected
        raise HTTPException(status_code=400, detail="Circular folder reference detected")
    
    visited.add(folder_id)
    
    try:
        folder = container.read_item(item=folder_id, partition_key=user_id)
        if folder.get("contentType") != "folder":
            return 0
        
        parent_id = folder.get("data", {}).get("parentFolderId")
        if not parent_id:
            return 0  # Root level folder
        
        return 1 + _calculate_folder_depth(parent_id, user_id, visited.copy())
    except Exception:
        # If folder doesn't exist, assume it's root level
        return 0

def _map_folder_doc_to_out(doc: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
    """Convert folder document to output format."""
    data = doc.get("data", {})
    folder_id = doc.get("id")
    
    # Count items in this folder
    items_count = 0
    if user_id and folder_id:
        try:
            query = "SELECT * FROM c WHERE c.userId = @userId AND c.folderId = @folderId"
            parameters = [
                {"name": "@userId", "value": user_id},
                {"name": "@folderId", "value": folder_id}
            ]
            items = list(container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            items_count = len(items)
        except Exception as e:
            print(f"Error counting items for folder {folder_id}: {e}")
            items_count = 0
    
    return {
        "id": folder_id,
        "name": data.get("name", ""),
        "color": data.get("color", ""),
        "parentFolderId": data.get("parentFolderId"),
        "createdAt": doc.get("createdAt"),
        "updatedAt": data.get("updatedAt"),
        "items": items_count,
    }

@app.get("/folders", response_model=List[FolderOut])
async def list_folders(user_claims: dict = Depends(validate_token)):
    """Get all folders for the authenticated user."""
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'folder' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        return [_map_folder_doc_to_out(item, user_claims["sub"]) for item in items]
    except Exception as e:
        print(f"Error listing folders: {e}")
        raise HTTPException(status_code=500, detail="Failed to list folders")

@app.post("/folders", response_model=FolderOut)
async def create_folder(body: CreateFolderRequest, user_claims: dict = Depends(validate_token)):
    """Create a new folder. Supports nesting with parentFolderId (max depth 3 levels)."""
    try:
        parent_folder_id = body.parentFolderId
        
        # Validate parent folder if provided
        if parent_folder_id:
            try:
                parent_folder = container.read_item(item=parent_folder_id, partition_key=user_claims["sub"])
                if parent_folder.get("contentType") != "folder":
                    raise HTTPException(status_code=400, detail="Parent item is not a folder")
                if parent_folder.get("userId") != user_claims["sub"]:
                    raise HTTPException(status_code=403, detail="Access denied to parent folder")
                
                # Calculate depth of parent folder
                parent_depth = _calculate_folder_depth(parent_folder_id, user_claims["sub"])
                if parent_depth >= 2:  # Max depth is 3 (0-indexed: 0, 1, 2)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot nest folder deeper than 3 levels. Current depth: {parent_depth + 1}"
                    )
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error validating parent folder: {e}")
                raise HTTPException(status_code=400, detail="Invalid parent folder")
        
        doc = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": "folder",
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "name": body.name.strip(),
                "color": body.color or "blue",
                "parentFolderId": parent_folder_id,
                "updatedAt": None,
            },
        }
        container.create_item(doc)
        return _map_folder_doc_to_out(doc, user_claims["sub"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to create folder")

@app.patch("/folders/{folder_id}", response_model=FolderOut)
async def update_folder(folder_id: str, body: UpdateFolderRequest, user_claims: dict = Depends(validate_token)):
    """Update folder properties. Supports changing parentFolderId with depth validation."""
    try:
        doc = container.read_item(item=folder_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"] or doc.get("contentType") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")

        data = doc.setdefault("data", {})
        
        # Handle parentFolderId update with depth validation
        if body.parentFolderId is not None:
            new_parent_id = body.parentFolderId if body.parentFolderId else None
            
            if new_parent_id:
                # Prevent setting self as parent
                if new_parent_id == folder_id:
                    raise HTTPException(status_code=400, detail="Folder cannot be its own parent")
                
                # Validate parent folder
                try:
                    parent_folder = container.read_item(item=new_parent_id, partition_key=user_claims["sub"])
                    if parent_folder.get("contentType") != "folder":
                        raise HTTPException(status_code=400, detail="Parent item is not a folder")
                    
                    # Calculate depth of parent folder
                    parent_depth = _calculate_folder_depth(new_parent_id, user_claims["sub"])
                    if parent_depth >= 2:  # Max depth is 3
                        raise HTTPException(
                            status_code=400,
                            detail=f"Cannot nest folder deeper than 3 levels. Current depth: {parent_depth + 1}"
                        )
                except HTTPException:
                    raise
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid parent folder")
            
            data["parentFolderId"] = new_parent_id
        
        if body.name is not None:
            data["name"] = body.name.strip()
        if body.color is not None:
            data["color"] = body.color

        data["updatedAt"] = datetime.utcnow().isoformat()
        container.replace_item(item=folder_id, body=doc)
        return _map_folder_doc_to_out(doc, user_claims["sub"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to update folder")

@app.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user_claims: dict = Depends(validate_token)):
    """Delete a folder. Note: Items in the folder are not automatically deleted."""
    try:
        doc = container.read_item(item=folder_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"] or doc.get("contentType") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        container.delete_item(item=folder_id, partition_key=user_claims["sub"])
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete folder")

@app.get("/folders/{folder_id}/items")
async def get_folder_items(
    folder_id: str,
    content_type: Optional[str] = Query(None, description="Filter by content type (quiz, flashcard_deck, study_plan, voice_note, etc.)"),
    user_claims: dict = Depends(validate_token)
):
    """Get all items in a folder. Supports filtering by content type."""
    try:
        # Verify folder exists and belongs to user
        folder = container.read_item(item=folder_id, partition_key=user_claims["sub"])
        if folder.get("userId") != user_claims["sub"] or folder.get("contentType") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Build query to get items in this folder
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.folderId = @folderId"
        parameters = [
            {"name": "@userId", "value": user_claims["sub"]},
            {"name": "@folderId", "value": folder_id}
        ]
        
        # Add content type filter if provided
        if content_type:
            query += " AND c.contentType = @contentType"
            parameters.append({"name": "@contentType", "value": content_type})
        
        query += " ORDER BY c.createdAt DESC"
        
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        return items
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching folder items: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch folder items")


@app.patch("/items/{item_id}/move")
async def move_item(
    item_id: str,
    request: Dict[str, Any] = Body(...),
    user_claims: dict = Depends(validate_token)
):
    """
    Move an item to a different folder by updating its folderId.
    Pass null to move item out of folders (root level).
    Request body: {"folder_id": "folder-id-string"} or {"folder_id": null}
    """
    try:
        # Extract folder_id from request body
        folder_id = request.get("folder_id") or request.get("folderId")
        
        # Read the item
        doc = container.read_item(item=item_id, partition_key=user_claims["sub"])
        
        # Verify ownership
        if doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Validate target folder if provided
        if folder_id:
            try:
                target_folder = container.read_item(item=folder_id, partition_key=user_claims["sub"])
                if target_folder.get("contentType") != "folder":
                    raise HTTPException(status_code=400, detail="Target is not a folder")
                if target_folder.get("userId") != user_claims["sub"]:
                    raise HTTPException(status_code=403, detail="Access denied to target folder")
            except CosmosResourceNotFoundError:
                raise HTTPException(status_code=404, detail="Target folder not found")
        
        # Update folderId
        if folder_id:
            doc["folderId"] = folder_id
        else:
            # Remove from folder (set to null or remove key)
            doc.pop("folderId", None)
        
        doc["updatedAt"] = datetime.utcnow().isoformat()
        container.replace_item(item=item_id, body=doc)
        
        return {"message": "Item moved successfully", "folderId": folder_id}
    except HTTPException:
        raise
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Item not found")
    except Exception as e:
        print(f"Error moving item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to move item: {str(e)}")


# --------------------------------------------------------------------------------------
# File Upload Endpoint
# --------------------------------------------------------------------------------------
@app.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    user_claims: dict = Depends(validate_token)
):
    """
    Simple file upload endpoint that stores file metadata in Cosmos DB.
    Files are stored in static/uploads directory.
    """
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = "static/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename to avoid collisions
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
        stored_filename = f"{file_id}{file_extension}"
        file_path = os.path.join(upload_dir, stored_filename)
        
        # Save file to disk
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Get file size
        file_size = len(content)
        
        # Determine file type
        file_type = file.content_type or "application/octet-stream"
        is_image = file_type.startswith("image/")
        is_pdf = file_type == "application/pdf"
        
        # Create document for Cosmos DB
        file_document = {
            "id": file_id,
            "userId": user_claims["sub"],
            "contentType": "uploaded_file",
            "folderId": folder_id,
            "createdAt": datetime.utcnow().isoformat(),
            "data": {
                "title": file.filename or "Untitled File",
                "originalFilename": file.filename,
                "storedFilename": stored_filename,
                "filePath": file_path,
                "fileSize": file_size,
                "fileType": file_type,
                "isImage": is_image,
                "isPdf": is_pdf,
            }
        }
        
        container.create_item(body=file_document)
        
        return {
            "id": file_id,
            "filename": file.filename,
            "fileSize": file_size,
            "fileType": file_type,
            "folderId": folder_id,
            "message": "File uploaded successfully"
        }
    except Exception as e:
        print(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@app.get("/files/{file_id}")
async def get_file(
    file_id: str,
    user_claims: dict = Depends(validate_token)
):
    """
    Serve uploaded file. Only allows access to files owned by the user.
    """
    try:
        # Get file document from Cosmos DB
        file_doc = container.read_item(item=file_id, partition_key=user_claims["sub"])
        
        # Verify ownership
        if file_doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Verify it's an uploaded file
        if file_doc.get("contentType") != "uploaded_file":
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = file_doc.get("data", {}).get("filePath")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        return FileResponse(
            path=file_path,
            media_type=file_doc.get("data", {}).get("fileType", "application/octet-stream"),
            filename=file_doc.get("data", {}).get("originalFilename", "file")
        )
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        print(f"Error serving file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve file: {str(e)}")


@app.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    user_claims: dict = Depends(validate_token)
):
    """
    Delete uploaded file from database and disk.
    """
    try:
        # Get file document from Cosmos DB
        file_doc = container.read_item(item=file_id, partition_key=user_claims["sub"])
        
        # Verify ownership
        if file_doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Verify it's an uploaded file
        if file_doc.get("contentType") != "uploaded_file":
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file from disk
        file_path = file_doc.get("data", {}).get("filePath")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Failed to delete file from disk: {str(e)}")
        
        # Delete from database
        container.delete_item(item=file_id, partition_key=user_claims["sub"])
        
        return {"message": "File deleted successfully"}
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


# --------------------------------------------------------------------------------------
# Dev server
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
