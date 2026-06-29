import os
import json
import re
import random

TOPIC_ALIASES = {
    "add": "addition",
    "addition": "addition",
    "subtract": "subtraction",
    "subtraction": "subtraction",
    "multiply": "multiplication",
    "multiplication": "multiplication",
    "divide": "division",
    "division": "division",
    "derivative": "derivatives",
    "derivatives": "derivatives",
    "differentiation": "derivatives",
    "chain rule": "derivatives",
    "product rule": "derivatives",
    "quotient rule": "derivatives",
    "integral": "integration",
    "integrals": "integration",
    "integration": "integration",
    "algebra": "algebra",
    "geometry": "geometry",
    "trigonometry": "trigonometry",
    "chemistry": "chemistry",
    "physics": "physics",
    "biology": "biology",
}

TOPIC_DISPLAY_NAMES = {
    "addition": "Addition",
    "subtraction": "Subtraction",
    "multiplication": "Multiplication",
    "division": "Division",
    "derivatives": "Derivatives",
    "integration": "Integration",
    "algebra": "Algebra",
    "geometry": "Geometry",
    "trigonometry": "Trigonometry",
    "chemistry": "Chemistry",
    "physics": "Physics",
    "biology": "Biology",
    "general": "General Practice",
}

TOPIC_STOPWORDS = {
    "a",
    "an",
    "and",
    "chapter",
    "concept",
    "concepts",
    "course",
    "for",
    "from",
    "generated",
    "introduction",
    "lesson",
    "practice",
    "quiz",
    "review",
    "test",
    "the",
    "to",
    "topic",
    "unit",
    "untitled",
}

QUIZIO_MASTERY_SCORE = 75
QUIZ_MATH_CONTROL_TRANSLATION = {
    8: r"\b",
    9: r"\t",
    12: r"\f",
    13: r"\r",
}
QUIZ_TEXT_COMMAND_REPLACEMENTS = {
    "sin": r"\sin",
    "cos": r"\cos",
    "tan": r"\tan",
    "ln": r"\ln",
}


def _clean_topic_text(value):
    text = str(value or "").strip()
    text = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", text)
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _split_topic_values(value):
    if value is None:
        return []
    if isinstance(value, dict):
        values = []
        for item in value.values():
            values.extend(_split_topic_values(item))
        return values
    if isinstance(value, (list, tuple, set)):
        values = []
        for item in value:
            values.extend(_split_topic_values(item))
        return values

    return [
        _clean_topic_text(part)
        for part in re.split(r"[,;\n]+", str(value))
        if _clean_topic_text(part)
    ]


def normalize_topic(value):
    text = _clean_topic_text(value).lower()
    if not text:
        return "general"

    normalized = re.sub(r"[^a-z0-9\s]", " ", text)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    for phrase, canonical in sorted(TOPIC_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if re.search(rf"\b{re.escape(phrase)}\b", normalized):
            return canonical

    words = [
        word
        for word in normalized.split()
        if len(word) > 2 and word not in TOPIC_STOPWORDS
    ]
    if not words:
        return "general"

    return "-".join(words[:3])


def _topic_display(topic_key, source=None):
    if topic_key in TOPIC_DISPLAY_NAMES:
        return TOPIC_DISPLAY_NAMES[topic_key]
    clean_source = _clean_topic_text(source)
    if clean_source and normalize_topic(clean_source) == topic_key:
        return clean_source.title()
    return topic_key.replace("-", " ").title()


def _quiz_topic_info(data):
    data = data or {}
    options = data.get("options") if isinstance(data.get("options"), dict) else {}
    candidates = [
        data.get("topicKey"),
        data.get("topic"),
        data.get("topicDisplay"),
        options.get("topicKey"),
        options.get("primaryTopic"),
        options.get("topic"),
        options.get("selectedTopics"),
        options.get("customTopics"),
        options.get("focusTopics"),
        data.get("title"),
        data.get("resourceName"),
    ]

    fallback = None
    for candidate in candidates:
        for value in _split_topic_values(candidate):
            if fallback is None:
                fallback = value
            topic_key = normalize_topic(value)
            if topic_key != "general":
                return topic_key, _topic_display(topic_key, value)

    topic_key = normalize_topic(fallback)
    return topic_key, _topic_display(topic_key, fallback)


def _repair_quiz_math_text(value):
    text = str(value or "")
    if not text:
        return text

    repaired = text.translate(QUIZ_MATH_CONTROL_TRANSLATION)
    repaired = re.sub(r"\\sqrt\s*\(\s*([^()]+?)\s*\)", r"\\sqrt{\1}", repaired, flags=re.IGNORECASE)
    repaired = re.sub(r"\\sqrt([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)", r"\\sqrt{\1}", repaired)
    repaired = re.sub(r"(?<!\\)sqrt\s*\{\s*([^{}]+?)\s*\}", r"\\sqrt{\1}", repaired, flags=re.IGNORECASE)
    repaired = re.sub(r"(?<!\\)sqrt\s*\(\s*([^()]+?)\s*\)", r"\\sqrt{\1}", repaired, flags=re.IGNORECASE)
    repaired = re.sub(r"(?<!\\)sqrt\s+([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)", r"\\sqrt{\1}", repaired, flags=re.IGNORECASE)
    repaired = re.sub(r"(?<!\\)sqrt([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)", r"\\sqrt{\1}", repaired, flags=re.IGNORECASE)
    repaired = re.sub(
        r"\\text\s*\{\s*(sin|cos|tan|ln)\s*\}",
        lambda match: QUIZ_TEXT_COMMAND_REPLACEMENTS[match.group(1).lower()],
        repaired,
        flags=re.IGNORECASE,
    )
    repaired = re.sub(r"\\text\s*\{\s*e\s*\}", "e", repaired, flags=re.IGNORECASE)
    repaired = re.sub(r"\\text\s*\{\s*([a-zA-Z]+)\s*\}\s*\(", r"\\\1(", repaired)
    return repaired


def _sanitize_quiz_question(question):
    if not isinstance(question, dict):
        return question

    sanitized = dict(question)

    for key in ("question", "correct_answer"):
        if isinstance(sanitized.get(key), str):
            sanitized[key] = _repair_quiz_math_text(sanitized[key])

    for key in ("options", "correct_answers", "prompts", "targets", "acceptable_answers"):
        if isinstance(sanitized.get(key), list):
            sanitized[key] = [
                _repair_quiz_math_text(item) if isinstance(item, str) else item
                for item in sanitized[key]
            ]

    if isinstance(sanitized.get("correct_mapping"), dict):
        sanitized["correct_mapping"] = {
            _repair_quiz_math_text(key) if isinstance(key, str) else key:
            _repair_quiz_math_text(value) if isinstance(value, str) else value
            for key, value in sanitized["correct_mapping"].items()
        }

    return sanitized


def _sanitize_quiz_payload(data):
    if not isinstance(data, dict):
        return data

    sanitized = dict(data)

    for key in ("title", "quiz_title"):
        if isinstance(sanitized.get(key), str):
            sanitized[key] = _repair_quiz_math_text(sanitized[key])

    if isinstance(sanitized.get("questions"), list):
        sanitized["questions"] = [
            _sanitize_quiz_question(question)
            for question in sanitized["questions"]
        ]

    return sanitized


def _ensure_quiz_topic_metadata(data, source_topic=None):
    data = _sanitize_quiz_payload(data)
    if not isinstance(data, dict):
        return data

    if source_topic:
        topic_key = normalize_topic(source_topic)
        topic_display = _topic_display(topic_key, source_topic)
    else:
        topic_key, topic_display = _quiz_topic_info(data)

    data["topicKey"] = topic_key
    data["topic"] = topic_display
    data["topicDisplay"] = topic_display

    options = data.get("options")
    if not isinstance(options, dict):
        options = {}
        data["options"] = options
    options["topicKey"] = topic_key
    options["primaryTopic"] = topic_display
    return data
import uuid
import uvicorn
import base64
import mimetypes
import shutil
import secrets
import hmac
import copy
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
import database
from pdf_utils import extract_text_from_pdf
from openai_client import generate_quiz, generate_answer_explanation, evaluate_short_answer, evaluate_numerical_answer, generate_study_plan, update_study_plan, summarize_text, generate_flashcard as openai_generate_flashcard, analyze_quiz_performance, generate_suggested_next_steps_ai
from models import QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse, QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest, UpdateStudyPlanResponse, Flashcard, FlashcardDeck, FlashcardDocument, MindmapDocument, SaveMindmapResponse, CreateMindmapRequest, CreateFolderRequest, UpdateFolderRequest, FolderOut, ShareLinkCreateRequest, ShareLinkUpdateRequest, ShareLinkSettings
from pydantic import BaseModel
from azure.cosmos.exceptions import CosmosHttpResponseError, CosmosResourceNotFoundError
import time
from openai_client import analyze_quiz_performance
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
    allow_headers=["*", "X-User-Id", "X-Study-Date"],
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
# For azure_blob
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_BLOB_ACCOUNT_NAME = os.getenv("AZURE_BLOB_ACCOUNT_NAME")
AZURE_BLOB_ACCOUNT_KEY = os.getenv("AZURE_BLOB_ACCOUNT_KEY")
AZURE_BLOB_CONTAINER = os.getenv("AZURE_BLOB_CONTAINER", "audio")
AZURE_BLOB_SAS_TTL_HOURS = int(os.getenv("AZURE_BLOB_SAS_TTL_HOURS", "0"))

def _resolve_storage_backend() -> str:
    explicit = (os.getenv("STORAGE_BACKEND") or "").strip().lower()
    if explicit:
        return explicit
    if AZURE_STORAGE_CONNECTION_STRING or (AZURE_BLOB_ACCOUNT_NAME and AZURE_BLOB_ACCOUNT_KEY):
        return "azure_blob"
    return "local"

STORAGE_BACKEND = _resolve_storage_backend()

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

    def replace_item(self, item: str, body: Dict[str, Any], partition_key: Optional[str] = None):
        items = self._load()
        for idx, it in enumerate(items):
            if it.get("id") == item:
                pk_value = it.get("userId") or it.get("user_id")
                if partition_key is not None and pk_value is not None and pk_value != partition_key:
                    raise HTTPException(status_code=404, detail="Item not found")
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

        if "from c where c.userid = @uid and c.contenttype = 'study_plan'" in q:
            user_id = params.get("@uid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType") == "study_plan" or it.get("contenttype") == "study_plan")
            ]
            filtered.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
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

        # Trash batch (restore / permanent delete cascade)
        if "c.deletedbatchid = @batchid" in q and "c.deleted = true" in q:
            user_id = params.get("@userid")
            batch_id = params.get("@batchid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and it.get("deletedBatchId") == batch_id
                and it.get("deleted") is True
            ]
            if "order by c.deletedat desc" in q:
                filtered.sort(key=lambda x: x.get("deletedAt", "") or x.get("deletedat", ""), reverse=True)
            return filtered

        # Unfiled items (not in any folder, not deleted, not folders)
        if (
            "c.contenttype != 'folder'" in q
            and "(not is_defined(c.folderid) or is_null(c.folderid))" in q
            and "(not is_defined(c.deleted) or c.deleted = false)" in q
        ):
            user_id = params.get("@userid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType", "").lower() not in {"folder", "shared_link"})
                and (it.get("contenttype", "").lower() not in {"folder", "shared_link"})
                and not it.get("folderId")
                and not it.get("deleted")
            ]
            if "and c.contenttype = @contenttype" in q:
                content_type = params.get("@contenttype")
                if content_type:
                    filtered = [
                it
                for it in filtered
                if (it.get("contentType", "").lower() == content_type.lower())
            ]
            if "order by c.createdat desc" in q:
                filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
            return filtered

        # Share link queries
        if "c.contenttype = 'shared_link'" in q:
            filtered = [
                it
                for it in items
                if (it.get("contentType", "").lower() == "shared_link" or it.get("contenttype", "").lower() == "shared_link")
            ]

            if "c.userid = @userid" in q:
                user_id = params.get("@userid")
                filtered = [
                    it
                    for it in filtered
                    if (it.get("userId") == user_id or it.get("user_id") == user_id)
                ]

            if "c.token = @token" in q:
                token = params.get("@token")
                filtered = [it for it in filtered if it.get("token") == token]

            if "c.source.itemid = @sourceitemid" in q:
                source_item_id = params.get("@sourceitemid")
                filtered = [
                    it
                    for it in filtered
                    if it.get("source", {}).get("itemId") == source_item_id
                ]

            if "c.source.itemcontenttype = @itemcontenttype" in q:
                item_content_type = params.get("@itemcontenttype")
                filtered = [
                    it
                    for it in filtered
                    if it.get("source", {}).get("itemContentType") == item_content_type
                ]

            if "c.state.status = 'active'" in q:
                filtered = [
                    it
                    for it in filtered
                    if it.get("state", {}).get("status") == "active"
                ]

            if "order by c.createdat desc" in q:
                filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)

            if "select top 1" in q:
                return filtered[:1]

            return filtered

        # Trash list / empty trash (all soft-deleted for user; not batch-scoped queries)
        if "c.userid = @userid" in q and "c.deleted = true" in q and "c.deletedbatchid = @batchid" not in q:
            user_id = params.get("@userid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and it.get("deleted") is True
            ]
            if "order by c.deletedat desc" in q:
                filtered.sort(key=lambda x: x.get("deletedAt", "") or x.get("deletedat", ""), reverse=True)
            return filtered

        # Descendant folder IDs (folder tree / cascade delete)
        if (
            "c.data.parentfolderid = @parentid" in q
            and "c.contenttype = 'folder'" in q
            and "c.userid = @userid" in q
        ):
            user_id = params.get("@userid")
            parent_id = params.get("@parentid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType", "").lower() == "folder" or it.get("contenttype", "").lower() == "folder")
                and it.get("data", {}).get("parentFolderId") == parent_id
            ]
            if q.strip().startswith("select c.id"):
                filtered = [{"id": it["id"]} for it in filtered]
            return filtered

        # Handle folder items query: "WHERE c.userId = @userId AND c.folderId = @folderId"
        if "from c where c.userid = @userid and c.folderid = @folderid" in q:
            user_id = params.get("@userid")
            folder_id = params.get("@folderid")

            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and it.get("folderId") == folder_id
            ]

            if "(not is_defined(c.deleted) or c.deleted = false)" in q:
                filtered = [it for it in filtered if not it.get("deleted")]

            # Add content type filter if present
            if "and c.contenttype = @contenttype" in q:
                content_type = params.get("@contenttype")
                filtered = [
                    it
                    for it in filtered
                    if (it.get("contentType", "").lower() == content_type.lower() or it.get("contenttype", "").lower() == content_type.lower())
                ]

            # Sort by createdAt if present
            filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
            return filtered

        # Handle folder query: "WHERE c.userId = @userId AND c.contentType = 'folder'"
        if "from c where c.userid = @userid and c.contenttype = 'folder'" in q:
            user_id = params.get("@userid")
            filtered = [
                it
                for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and (it.get("contentType", "").lower() == "folder" or it.get("contenttype", "").lower() == "folder")
            ]
            if "(not is_defined(c.deleted) or c.deleted = false)" in q:
                filtered = [it for it in filtered if not it.get("deleted")]
            filtered.sort(key=lambda x: x.get("createdAt", "") or x.get("createdat", ""), reverse=True)
            return filtered

        # Handle study streak query: "WHERE c.userId = @uid AND c.contentType = 'study_streak'"
        if "from c where c.userid = @uid and c.contenttype = 'study_streak'" in q:
            user_id = params.get("@uid")
            return [
                it for it in items
                if (it.get("userId") == user_id or it.get("user_id") == user_id)
                and it.get("contentType") == "study_streak"
            ]

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

# Cosmos when credentials exist and the DB/container is reachable; otherwise local JSON store.
# USE_LOCAL_JSON_STORE=1 forces ./_localdb even if Cosmos keys are set (local dev).
# COSMOS_FALLBACK_TO_LOCAL=0 disables auto-fallback when Cosmos returns 404/unreachable (fail fast in prod).
client = database.client
cosmos_error: Optional[str] = None
_use_local = os.getenv("USE_LOCAL_JSON_STORE", "").strip().lower() in ("1", "true", "yes")
_cosmos_fallback = os.getenv("COSMOS_FALLBACK_TO_LOCAL", "1").strip().lower() not in ("0", "false", "no")

if _use_local:
    container = LocalContainer("./_localdb")
    storage_mode = "local"
elif database.container is not None:
    try:
        list(
            database.container.query_items(
                query="SELECT TOP 1 c.id FROM c",
                enable_cross_partition_query=True,
                max_item_count=1,
            )
        )
        container = database.container
        storage_mode = "cosmos"
    except (CosmosResourceNotFoundError, CosmosHttpResponseError) as e:
        cosmos_error = str(e)
        err_status = getattr(e, "status_code", None)
        is_not_found = isinstance(e, CosmosResourceNotFoundError) or err_status == 404
        if _cosmos_fallback and is_not_found:
            print(
                "WARNING: Cosmos database or container not found (404). "
                "Using local JSON store at ./_localdb. "
                "Create the Azure resources, fix COSMOS_DB_* in .env, or set USE_LOCAL_JSON_STORE=1. "
                "Set COSMOS_FALLBACK_TO_LOCAL=0 to disable this fallback."
            )
            container = LocalContainer("./_localdb")
            storage_mode = "local"
        else:
            container = database.container
            storage_mode = "cosmos"
    except Exception as e:
        cosmos_error = str(e)
        if _cosmos_fallback:
            print(
                f"WARNING: Cosmos not usable ({e!s}). Using local JSON store at ./_localdb. "
                "Set COSMOS_FALLBACK_TO_LOCAL=0 to fail fast instead."
            )
            container = LocalContainer("./_localdb")
            storage_mode = "local"
        else:
            container = database.container
            storage_mode = "cosmos"
else:
    container = LocalContainer("./_localdb")
    storage_mode = "local"

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def _user_id_from_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        claims = jwt.decode(
            token,
            key="development_key_not_for_production",
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False
            }
        )
        return claims.get("sub") or claims.get("oid") or claims.get("userId")
    except Exception as e:
        print(f"DEBUG: Could not resolve user id from bearer token: {e}")
        return None

def _resolve_user_id(request: Request, user_id_q: Optional[str] = None, user_id_form: Optional[str] = None) -> str:
    return (
        user_id_q
        or user_id_form
        or request.headers.get("X-User-Id")
        or _user_id_from_bearer_token(request)
        or "default"
    )

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


SHAREABLE_CONTENT_TYPES = {
    "flashcard_deck",
    "quiz",
    "study_plan",
    "summary",
}


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


def _get_item_owner(item: Dict[str, Any]) -> Optional[str]:
    return item.get("userId") or item.get("user_id")


def _is_shareable_content_type(content_type: Optional[str]) -> bool:
    return (content_type or "").strip().lower() in SHAREABLE_CONTENT_TYPES


def _load_owned_item(item_id: str, user_id: str) -> Dict[str, Any]:
    try:
        item = container.read_item(item=item_id, partition_key=user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Source item not found")

    if _get_item_owner(item) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    content_type = item.get("contentType")
    if not _is_shareable_content_type(content_type):
        raise HTTPException(status_code=400, detail="This item type cannot be shared yet")

    if item.get("deleted") is True:
        raise HTTPException(status_code=404, detail="Source item not found")

    return item


def _normalize_share_settings(raw_settings: Optional[Union[ShareLinkSettings, Dict[str, Any]]]) -> Dict[str, Any]:
    if isinstance(raw_settings, ShareLinkSettings):
        settings = raw_settings.dict()
    elif isinstance(raw_settings, dict):
        settings = ShareLinkSettings(**raw_settings).dict()
    else:
        settings = ShareLinkSettings().dict()

    expires_at = settings.get("expiresAt")
    if expires_at:
        try:
            datetime.fromisoformat(expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="expiresAt must be a valid ISO timestamp")

    max_imports = settings.get("maxImports")
    if max_imports is not None and max_imports < 1:
        raise HTTPException(status_code=400, detail="maxImports must be at least 1")

    return settings


def _serialize_share_link(link: Dict[str, Any], request: Request) -> Dict[str, Any]:
    token = link.get("token", "")
    return {
        "id": link["id"],
        "token": token,
        "source": link.get("source", {}),
        "settings": link.get("settings", {}),
        "state": link.get("state", {}),
        "createdAt": link.get("createdAt"),
        "updatedAt": link.get("updatedAt"),
        "sharePath": f"/share/{token}" if token else None,
    }


def _find_active_share_link(owner_id: str, source_item_id: str, item_content_type: str) -> Optional[Dict[str, Any]]:
    query = """
    SELECT TOP 1 * FROM c
    WHERE c.userId = @userId
      AND c.contentType = 'shared_link'
      AND c.source.itemId = @sourceItemId
      AND c.source.itemContentType = @itemContentType
      AND c.state.status = 'active'
    ORDER BY c.createdAt DESC
    """
    parameters = [
        {"name": "@userId", "value": owner_id},
        {"name": "@sourceItemId", "value": source_item_id},
        {"name": "@itemContentType", "value": item_content_type},
    ]
    links = list(
        container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        )
    )
    return links[0] if links else None


def _get_share_link_by_token(token: str) -> Dict[str, Any]:
    query = "SELECT * FROM c WHERE c.contentType = 'shared_link' AND c.token = @token"
    parameters = [{"name": "@token", "value": token}]
    links = list(
        container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        )
    )

    for link in links:
        if hmac.compare_digest(link.get("token", ""), token):
            return link

    raise HTTPException(status_code=404, detail="Share link not found")


def _ensure_share_link_is_available(link: Dict[str, Any], *, for_import: bool = False) -> None:
    state = link.get("state", {})
    settings = link.get("settings", {})

    if state.get("status") != "active":
        raise HTTPException(status_code=404, detail="Share link not found")

    expires_at = settings.get("expiresAt")
    if expires_at:
        try:
            if datetime.fromisoformat(expires_at) <= datetime.utcnow():
                raise HTTPException(status_code=410, detail="Share link expired")
        except ValueError:
            raise HTTPException(status_code=410, detail="Share link expired")

    if for_import:
        if not settings.get("allowImport", True):
            raise HTTPException(status_code=403, detail="Import is disabled for this share link")
        max_imports = settings.get("maxImports")
        import_count = int(state.get("importCount") or 0)
        if max_imports is not None and import_count >= int(max_imports):
            raise HTTPException(status_code=410, detail="Share link import limit reached")


def _extract_shared_preview(source_item: Dict[str, Any]) -> Dict[str, Any]:
    content_type = source_item.get("contentType")

    if content_type == "flashcard_deck":
        cards = source_item.get("cards") or []
        return {
            "title": source_item.get("title") or "Untitled Flashcard Deck",
            "subtitle": f"{len(cards)} flashcards",
            "cards": cards,
        }

    if content_type == "quiz":
        data = source_item.get("data", {})
        questions = data.get("questions") or []
        sanitized_questions = []
        for question in questions:
            q = copy.deepcopy(question)
            q.pop("correctAnswer", None)
            q.pop("correct_answer", None)
            q.pop("answer", None)
            q.pop("explanation", None)
            sanitized_questions.append(q)
        return {
            "title": data.get("title") or "Untitled Quiz",
            "subtitle": f"{len(questions)} questions",
            "resourceName": data.get("resourceName"),
            "questions": sanitized_questions,
        }

    if content_type == "study_plan":
        data = source_item.get("data", {})
        return {
            "title": data.get("title") or "Untitled Study Plan",
            "subtitle": data.get("description") or "",
            "description": data.get("description") or "",
            "tags": data.get("tags") or [],
            "content": data.get("content"),
        }

    if content_type == "summary":
        data = source_item.get("data", {})
        return {
            "title": source_item.get("title") or "Untitled Summary",
            "subtitle": source_item.get("description") or "",
            "description": source_item.get("description") or "",
            "summary": data.get("summary") or "",
            "style": data.get("style"),
            "format": data.get("format"),
        }

    raise HTTPException(status_code=400, detail="Unsupported shared content type")


def _build_share_preview_payload(link: Dict[str, Any], source_item: Dict[str, Any]) -> Dict[str, Any]:
    owner_name = link.get("ownerDisplayName") or "A classmate"
    return {
        "linkId": link["id"],
        "contentType": source_item.get("contentType"),
        "owner": {
            "userId": link.get("userId"),
            "displayName": owner_name,
        },
        "source": {
            "itemId": source_item.get("id"),
            "createdAt": source_item.get("createdAt"),
            "updatedAt": source_item.get("updatedAt") or source_item.get("data", {}).get("updatedAt"),
        },
        "settings": link.get("settings", {}),
        "preview": _extract_shared_preview(source_item),
    }


def _clone_shared_item_for_user(source_item: Dict[str, Any], recipient_user_id: str, share_link_id: str) -> Dict[str, Any]:
    now = _utcnow_iso()
    content_type = source_item.get("contentType")

    if content_type == "flashcard_deck":
        clone = {
            "id": str(uuid.uuid4()),
            "userId": recipient_user_id,
            "contentType": "flashcard_deck",
            "createdAt": now,
            "updatedAt": now,
            "title": source_item.get("title") or "Untitled Flashcard Deck",
            "cards": copy.deepcopy(source_item.get("cards") or []),
        }
    elif content_type == "quiz":
        source_data = copy.deepcopy(source_item.get("data") or {})
        source_data["userAnswers"] = None
        source_data["score"] = None
        source_data["timeTaken"] = 0
        source_data["attempts"] = []
        clone = {
            "id": str(uuid.uuid4()),
            "userId": recipient_user_id,
            "contentType": "quiz",
            "createdAt": now,
            "updatedAt": now,
            "data": source_data,
        }
    elif content_type == "study_plan":
        source_data = copy.deepcopy(source_item.get("data") or {})
        source_data["updatedAt"] = None
        clone = {
            "id": str(uuid.uuid4()),
            "userId": recipient_user_id,
            "contentType": "study_plan",
            "createdAt": now,
            "updatedAt": now,
            "data": source_data,
        }
    elif content_type == "summary":
        clone = {
            "id": str(uuid.uuid4()),
            "userId": recipient_user_id,
            "title": source_item.get("title") or "Untitled Summary",
            "description": source_item.get("description") or "",
            "contentType": "summary",
            "data": copy.deepcopy(source_item.get("data") or {}),
            "createdAt": now,
            "updatedAt": now,
        }
    else:
        raise HTTPException(status_code=400, detail="Unsupported shared content type")

    clone["sharedSource"] = {
        "shareLinkId": share_link_id,
        "originalItemId": source_item.get("id"),
        "originalOwnerId": _get_item_owner(source_item),
        "importedAt": now,
    }
    clone.pop("folderId", None)
    clone.pop("deleted", None)
    clone.pop("deletedAt", None)
    clone.pop("deletedBatchId", None)
    return clone

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
    
    uid = uid or _resolve_user_id(request)

    if not uid or uid == "default":
        print(f"DEBUG: /api/recents called with uid={uid}, returning empty recents")
        return {"items": []}

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
            content_type = (item.get("contentType") or item.get("contenttype") or "unknown").lower()
            data = item.get("data") or {}
            resource_name = item.get("resourceName") or item.get("name") or ""
            raw_title = (
                item.get("title")
                or item.get("name")
                or data.get("title")
                or data.get("name")
                or data.get("quiz_title")
                or resource_name
                or ""
            )
            display_title = raw_title.strip() or {
                "quiz": "Practice Test",
                "flashcard": "Flashcard",
                "flashcard_deck": "Flashcard Deck",
                "mindmap": "Mind Map",
                "study_plan": "Study Plan",
                "summary": "Summary",
                "voice_note": "Voice Note",
                "folder": "Folder",
                "tool": "Tool",
            }.get(content_type, "Untitled")

            result_items.append({
                "id": item.get("id"),
                "title": display_title,
                "rawTitle": raw_title,
                "contentType": content_type,
                "createdAt": item.get("createdAt"),
                "updatedAt": item.get("updatedAt"),
                "route": item.get("route"),
            })

        return {"items": result_items}
    except Exception as e:
        print(f"DEBUG: Error in /api/recents: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"items": []}

# ----- Track Tool Access -----
@app.post("/api/track-access")
async def track_tool_access(
    request: Request,
    item_id: str = Body(...),
):
    """Track when a user accesses/opens a tool to keep recents updated"""
    uid = _resolve_user_id(request)

    try:
        query = "SELECT * FROM c WHERE c.id = @id AND c.userId = @uid"
        params = [
            {"name": "@id", "value": item_id},
            {"name": "@uid", "value": uid},
        ]

        items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

        if not items:
            return {"success": False, "error": "Item not found"}

        item = items[0]
        item["updatedAt"] = datetime.utcnow().isoformat()
        container.upsert_item(item)

        return {"success": True, "message": "Access tracked"}
    except Exception as e:
        print(f"DEBUG: Error in track-access: {str(e)}")
        return {"success": False}

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

# Returns "Suggested Next Steps".
@app.get("/dashboard/next-steps")
def get_suggested_next_steps(user_claims: dict = Depends(validate_token)):
    uid = user_claims["sub"]

    # Fetch all items for this user once, then filter in Python (more reliable than query params here)
    all_user_items = list(container.query_items(
        query="SELECT * FROM c WHERE c.userId = @uid",
        parameters=[{"name": "@uid", "value": uid}],
        enable_cross_partition_query=True
    ))

    def get_latest_by_type(desired_types):
        if isinstance(desired_types, str):
            desired_types = [desired_types]
        matches = [x for x in all_user_items if x.get("contentType") in desired_types]
        matches.sort(key=lambda x: x.get("updatedAt") or x.get("createdAt") or "", reverse=True)
        return matches[0] if matches else None

    latest_deck = get_latest_by_type("flashcard_deck")
    latest_quiz = get_latest_by_type("quiz")
    latest_note = get_latest_by_type("voice_note")
    latest_mindmap = get_latest_by_type(["mind-map", "mindmap", "mind_map"])
    latest_summary = get_latest_by_type(["summarizer", "summary"])

    # Build targets list for AI
    targets = []

    if latest_deck:
        deck_title = latest_deck.get("title") or latest_deck.get("data", {}).get("title") or "Flashcards"
        targets.append({
            "toolKey": "flashcard_deck",
            "targetId": latest_deck["id"],
            "toolName": "AI Flashcards",
            "context": deck_title,
        })

    if latest_quiz:
        quiz_title = latest_quiz.get("data", {}).get("title") or "Practice Test"
        targets.append({
            "toolKey": "quiz",
            "targetId": latest_quiz["id"],
            "toolName": "Practice Tests",
            "context": quiz_title,
        })

    if latest_note:
        note_title = latest_note.get("title") or "Voice Note"
        targets.append({
            "toolKey": "voice_note",
            "targetId": latest_note["id"],
            "toolName": "Voice Notes",
            "context": note_title,
        })

    if latest_mindmap:
        mm_title = latest_mindmap.get("title") or "Mind Map"
        targets.append({
            "toolKey": "mind_map",
            "targetId": latest_mindmap["id"],
            "toolName": "Mind Maps",
            "context": mm_title,
        })

    if latest_summary:
        s_title = latest_summary.get("title") or "Summary"
        targets.append({
            "toolKey": "summarizer",
            "targetId": latest_summary["id"],
            "toolName": "Smart Summarizer",
            "context": s_title,
        })

    # ---- FILLER TARGETS: suggest creating new content for missing tools ----

    # Decide the "seed" topic/context:
    # - If we have any saved items, use the first available context/title
    # - Otherwise use a generic topic
    seed_context = next((t.get("context") for t in targets if t.get("context")), None)
    if not seed_context:
        seed_context = "your current study topic"

    # Which toolKeys already exist from saved items
    present = {t["toolKey"] for t in targets}

    # Tools we want Suggested Next Steps to support (no study_planner for now)
    ALL_TOOLS = [
        ("flashcard_deck", "AI Flashcards"),
        ("quiz", "Practice Tests"),
        ("voice_note", "Voice Notes"),
        ("mind_map", "Mind Maps"),
        ("summarizer", "Smart Summarizer"),
    ]

    # Add a "create new" filler target for any tool not already present
    for toolKey, toolName in ALL_TOOLS:
        if toolKey not in present:
            targets.append({
                "toolKey": toolKey,
                "targetId": "new",
                "toolName": toolName,
                "context": seed_context,
            })

    # If nothing exists yet, return safe fallback
    if not targets:
        return {"items": []}

    targets = targets[:5]

    # Randomize order of suggested tools/cards
    random.shuffle(targets)

    ai_result = generate_suggested_next_steps_ai(targets)
    items = ai_result.get("items", [])
    items = items[:3]

    # Map toolKey + targetId -> deep link actionPath
    def to_action_path(toolKey: str, targetId: str) -> str:

        if targetId == "new":
            if toolKey == "voice_note":
                return "/tools/voice-notes"
            if toolKey == "mind_map":
                return "/tools/mind-maps"  # or "/tools/maps" if that is your create page
            if toolKey == "summarizer":
                return "/tools/summarizer"
            if toolKey == "quiz":
                return "/tools/practice-tests"
            if toolKey == "flashcard_deck":
                return "/tools/flashcards"
            return "/dashboard"

        if toolKey == "flashcard_deck":
            return f"/tools/flashcards/study/{targetId}"
        if toolKey == "quiz":
            return f"/tools/practice-tests?quizId={targetId}"
        if toolKey == "voice_note":
            return f"/tools/voice-notes?noteId={targetId}"
        if toolKey == "mind_map":
            return f"/tools/maps/{targetId}"
        if toolKey == "summarizer":
            return f"/tools/summarizer?summaryId={targetId}"
        return "/dashboard"

    # Build final response for frontend
    final_items = []
    for item in items:
        toolKey = item.get("toolKey")
        targetId = item.get("targetId")
        final_items.append({
            "toolKey": toolKey,
            "title": item.get("title", "Suggested Next Step"),
            "description": item.get("description", ""),
            "buttonText": item.get("buttonText", "Open"),
            "actionPath": to_action_path(toolKey, targetId),
        })

    return {"items": final_items}

# ----- Quizzes -----
class QuizDataModel(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    topicKey: Optional[str] = None
    topicDisplay: Optional[str] = None
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
    subject_category: Optional[str] = Form("conceptual"),
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
            question_formats=selected_formats,
            subject_category=subject_category
        )

        quiz_data = _sanitize_quiz_payload(json.loads(quiz_json))
        quiz_id = str(uuid.uuid4())
        
        
        quiz_payload = _ensure_quiz_topic_metadata({
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
                "questionFormats": formats_dict,
                    "subjectCategory": subject_category
            },
            "attempts": []
        }, source_topic=focus_topics or None)

        quiz_document = {
            "id": quiz_id,
            "userId": user_claims["sub"],
            "contentType": "quiz",
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz_payload,
        }
        
        # Add folderId if provided
        if folder_id:
            quiz_document["folderId"] = folder_id

        container.create_item(body=quiz_document)
        quiz_data["id"] = quiz_document["id"]
        quiz_data["topicKey"] = quiz_payload["topicKey"]
        quiz_data["topic"] = quiz_payload["topic"]
        quiz_data["topicDisplay"] = quiz_payload["topicDisplay"]
        print(f"Quiz generated and saved with ID: {quiz_id}")
        return quiz_data
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate quiz: {str(e)}")

def _score_to_int(score):
    if score is None:
        return None
    try:
        if isinstance(score, str):
            score = score.replace("%", "").strip()
        return int(float(score))
    except (TypeError, ValueError):
        return None


def _latest_attempt_score(data: Dict[str, Any]) -> Optional[int]:
    scored_attempts = []
    for attempt in data.get("attempts", []) or []:
        score = _score_to_int(attempt.get("score"))
        if score is None:
            continue
        scored_attempts.append((attempt.get("timestamp", ""), score))

    if not scored_attempts:
        return None

    scored_attempts.sort(key=lambda item: item[0] or "")
    return scored_attempts[-1][1]


def _get_quizio_focus_areas(user_id: str) -> List[Dict[str, Any]]:
    query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'quiz'"
    parameters = [{"name": "@userId", "value": user_id}]

    quizzes = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True
    ))

    topic_scores: Dict[str, int] = {}
    topic_display: Dict[str, str] = {}

    for quiz in quizzes:
        data = quiz.get("data", {}) or {}
        latest_score = _latest_attempt_score(data)
        if latest_score is None:
            continue

        topic_key, display = _quiz_topic_info(data)
        if topic_key == "general":
            continue

        topic_display.setdefault(topic_key, display)
        topic_scores[topic_key] = max(topic_scores.get(topic_key, latest_score), latest_score)

    weak_topics = [
        {
            "topic": topic_key,
            "display": topic_display.get(topic_key, _topic_display(topic_key)),
            "score": score,
            "masteryScore": QUIZIO_MASTERY_SCORE,
        }
        for topic_key, score in topic_scores.items()
        if score < QUIZIO_MASTERY_SCORE
    ]

    weak_topics.sort(key=lambda item: (item["score"], item["display"]))
    return weak_topics


@app.post("/generate-focus-quiz")
async def generate_focus_quiz(user_claims: dict = Depends(validate_token)):
    try:
        user_id = user_claims["sub"]
        weak_areas = _get_quizio_focus_areas(user_id)

        if not weak_areas:
            return {
                "quiz": None,
                "focusAreas": [],
                "message": "No weak quiz topics found"
            }

        weak_topics = [item["display"] for item in weak_areas]

        #Generate quiz
        synthetic_text = f"Focus on weak areas: {', '.join(weak_topics)}"

        quiz_json = generate_quiz(
            text=synthetic_text,
            num_questions=10,
            focus_topics=", ".join(weak_topics),
            question_formats=["multiple_choice"]
        )

        quiz_data = _sanitize_quiz_payload(json.loads(quiz_json))

        return {
            "quiz": quiz_data,
            "focusAreas": weak_areas
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/weak-areas")
async def get_weak_areas(user_claims: dict = Depends(validate_token)):
    try:
        user_id = user_claims["sub"]
        return {"focusAreas": _get_quizio_focus_areas(user_id)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
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
        topic_key = (payload.get("topic_key") or payload.get("topicKey") or "").strip()
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
            
        subject_category = payload.get("subject_category", "conceptual")

        # Use the topic string as synthetic "text" input for the quiz generator
        synthetic_text = f"Create a quiz for the following topic/chapter/concept:\n\n{topic}"

        quiz_json = generate_quiz(
            text=synthetic_text,
            num_questions=num_questions,
            focus_topics=focus_topics.strip(),
            question_formats=selected_formats,
            subject_category=subject_category,
        )

        quiz_data = _sanitize_quiz_payload(json.loads(quiz_json))
        quiz_id = str(uuid.uuid4())
        quiz_payload = _ensure_quiz_topic_metadata({
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
                    "subjectCategory": subject_category,
            },
            "attempts": [],
        }, source_topic=topic_key or topic)

        quiz_document = {
            "id": quiz_id,
            "userId": user_claims["sub"],
            "contentType": "quiz",
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz_payload,
        }
        
        # Add folderId if provided
        folder_id = payload.get("folder_id") or payload.get("folderId")
        if folder_id:
            quiz_document["folderId"] = folder_id

        container.create_item(body=quiz_document)
        quiz_data["id"] = quiz_document["id"]
        quiz_data["topicKey"] = quiz_payload["topicKey"]
        quiz_data["topic"] = quiz_payload["topic"]
        quiz_data["topicDisplay"] = quiz_payload["topicDisplay"]
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
        data = _ensure_quiz_topic_metadata(quiz.data.dict())
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": data
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
            "score": _score_to_int(attempt.score),
            "timeTaken": attempt.timeTaken,
            "userAnswers": attempt.userAnswers,
            "mode": attempt.mode
        }

        if "attempts" not in quiz["data"]:
            quiz["data"]["attempts"] = []
        quiz["data"]["attempts"].append(new_attempt)
        quiz["data"] = _ensure_quiz_topic_metadata(quiz["data"])
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
        for item in items:
            if isinstance(item.get("data"), dict):
                item["data"] = _ensure_quiz_topic_metadata(item["data"])
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
        if isinstance(quiz.get("data"), dict):
            quiz["data"] = _ensure_quiz_topic_metadata(quiz["data"])
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
        if isinstance(quiz.get("data"), dict):
            quiz["data"] = _ensure_quiz_topic_metadata(quiz["data"])
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
            if item.get("contentType") != "study_plan" or not isinstance(item.get("data"), dict):
                continue
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
        question_type = request.question.get("type", "")
        if question_type == "numerical":
            result = evaluate_numerical_answer(
                question=request.question,
                user_answer=request.userAnswer
            )
        else:
            result = evaluate_short_answer(
                question=request.question,
                user_answer=request.userAnswer
            )
        return {"isCorrect": result["is_correct"], "aiResponse": result["ai_response"]}
    except Exception as e:
        print(f"Error evaluating answer: {str(e)}")
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


# ----- Share Links -----
@app.post("/share-links")
async def create_share_link(
    request: Request,
    body: ShareLinkCreateRequest,
    user_claims: dict = Depends(validate_token),
):
    user_id = user_claims.get("oid") or user_claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    source_item = _load_owned_item(body.sourceItemId, user_id)
    settings = _normalize_share_settings(body.settings)
    now = _utcnow_iso()
    owner_display_name = (
        user_claims.get("name")
        or user_claims.get("preferred_username")
        or "A classmate"
    )

    share_link = _find_active_share_link(
        owner_id=user_id,
        source_item_id=source_item["id"],
        item_content_type=source_item["contentType"],
    )

    if share_link:
        share_link["settings"] = settings
        share_link["updatedAt"] = now
        share_link["ownerDisplayName"] = owner_display_name
        container.replace_item(
            item=share_link["id"],
            body=share_link,
            partition_key=user_id,
        )
    else:
        share_link = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "ownerDisplayName": owner_display_name,
            "contentType": "shared_link",
            "token": secrets.token_urlsafe(32),
            "source": {
                "itemId": source_item["id"],
                "itemContentType": source_item["contentType"],
            },
            "settings": settings,
            "state": {
                "status": "active",
                "importCount": 0,
                "lastAccessedAt": None,
                "lastImportedAt": None,
            },
            "createdAt": now,
            "updatedAt": now,
        }
        container.create_item(body=share_link)

    return _serialize_share_link(share_link, request)


@app.get("/share-links")
async def list_share_links(
    request: Request,
    source_item_id: Optional[str] = Query(None),
    user_claims: dict = Depends(validate_token),
):
    user_id = user_claims.get("oid") or user_claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'shared_link' ORDER BY c.createdAt DESC"
    parameters = [{"name": "@userId", "value": user_id}]

    links = list(
        container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        )
    )

    if source_item_id:
        links = [link for link in links if link.get("source", {}).get("itemId") == source_item_id]

    return [_serialize_share_link(link, request) for link in links]


@app.patch("/share-links/{share_link_id}")
async def update_share_link(
    share_link_id: str,
    body: ShareLinkUpdateRequest,
    request: Request,
    user_claims: dict = Depends(validate_token),
):
    user_id = user_claims.get("oid") or user_claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        share_link = container.read_item(item=share_link_id, partition_key=user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share_link.get("contentType") != "shared_link" or _get_item_owner(share_link) != user_id:
        raise HTTPException(status_code=404, detail="Share link not found")

    if body.settings is not None:
        share_link["settings"] = _normalize_share_settings(body.settings)

    if body.status is not None:
        if body.status not in {"active", "revoked"}:
            raise HTTPException(status_code=400, detail="status must be 'active' or 'revoked'")
        share_link.setdefault("state", {})["status"] = body.status

    share_link["updatedAt"] = _utcnow_iso()
    container.replace_item(item=share_link_id, body=share_link, partition_key=user_id)
    return _serialize_share_link(share_link, request)


@app.post("/share-links/{share_link_id}/revoke")
async def revoke_share_link(
    share_link_id: str,
    request: Request,
    user_claims: dict = Depends(validate_token),
):
    user_id = user_claims.get("oid") or user_claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        share_link = container.read_item(item=share_link_id, partition_key=user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share_link.get("contentType") != "shared_link" or _get_item_owner(share_link) != user_id:
        raise HTTPException(status_code=404, detail="Share link not found")

    share_link.setdefault("state", {})["status"] = "revoked"
    share_link["updatedAt"] = _utcnow_iso()
    container.replace_item(item=share_link_id, body=share_link, partition_key=user_id)
    return _serialize_share_link(share_link, request)


@app.get("/share/{token}")
async def get_shared_content(token: str):
    link = _get_share_link_by_token(token)
    _ensure_share_link_is_available(link)

    if link.get("settings", {}).get("requireAuthToView"):
        raise HTTPException(status_code=403, detail="Sign-in required to view this share link")

    owner_id = link.get("userId")
    source_meta = link.get("source", {})

    try:
        source_item = container.read_item(item=source_meta.get("itemId"), partition_key=owner_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    if _get_item_owner(source_item) != owner_id or source_item.get("contentType") != source_meta.get("itemContentType"):
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    if source_item.get("deleted") is True:
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    link.setdefault("state", {})["lastAccessedAt"] = _utcnow_iso()
    link["updatedAt"] = _utcnow_iso()
    container.replace_item(item=link["id"], body=link, partition_key=owner_id)

    return _build_share_preview_payload(link, source_item)


@app.post("/share/{token}/import")
async def import_shared_content(
    token: str,
    user_claims: dict = Depends(validate_token),
):
    recipient_user_id = user_claims.get("oid") or user_claims.get("sub")
    if not recipient_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    link = _get_share_link_by_token(token)
    _ensure_share_link_is_available(link, for_import=True)

    owner_id = link.get("userId")
    source_meta = link.get("source", {})

    try:
        source_item = container.read_item(item=source_meta.get("itemId"), partition_key=owner_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    if _get_item_owner(source_item) != owner_id or source_item.get("contentType") != source_meta.get("itemContentType"):
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    if source_item.get("deleted") is True:
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    imported_item = _clone_shared_item_for_user(
        source_item=source_item,
        recipient_user_id=recipient_user_id,
        share_link_id=link["id"],
    )
    container.create_item(body=imported_item)

    state = link.setdefault("state", {})
    state["importCount"] = int(state.get("importCount") or 0) + 1
    now = _utcnow_iso()
    state["lastImportedAt"] = now
    state["lastAccessedAt"] = now
    link["updatedAt"] = now
    container.replace_item(item=link["id"], body=link, partition_key=owner_id)

    return {
        "id": imported_item["id"],
        "contentType": imported_item["contentType"],
        "message": "Shared item imported successfully",
    }

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
    subject_category: Optional[str] = "conceptual"


def parse_flashcard_json(raw: str) -> Dict[str, Any]:
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        repaired = repair_json(cleaned)
        return json.loads(repaired)


def normalize_flashcard_deck(deck: Dict[str, Any], fallback_title: str) -> Dict[str, Any]:
    raw_cards = deck.get("cards")
    if not isinstance(raw_cards, list):
        raise ValueError("Flashcard response did not include a cards array")

    normalized_cards = []
    seen_cards = set()
    for raw_card in raw_cards:
        if not isinstance(raw_card, dict):
            continue

        question = str(raw_card.get("question") or raw_card.get("front") or "").strip()
        answer = str(raw_card.get("answer") or raw_card.get("back") or "").strip()

        if not question or not answer:
            continue

        difficulty = str(raw_card.get("difficulty") or "medium").strip().lower()
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = "medium"

        important = raw_card.get("important", False)
        if isinstance(important, str):
            important = important.strip().lower() in {"true", "1", "yes"}
        else:
            important = bool(important)

        dedupe_key = (question.casefold(), answer.casefold())
        if dedupe_key in seen_cards:
            continue
        seen_cards.add(dedupe_key)

        normalized_cards.append(
            {
                "question": question,
                "answer": answer,
                "difficulty": difficulty,
                "important": important,
            }
        )

    return {
        "title": str(deck.get("title") or fallback_title).strip() or fallback_title,
        "cards": normalized_cards,
    }


def build_flashcard_generation_prompt(
    source_text: str,
    requested_count: int,
    existing_cards: Optional[List[Dict[str, Any]]] = None,
) -> str:
    if not existing_cards:
        return source_text

    existing_summary = json.dumps(
        [
            {
                "question": card["question"],
                "answer": card["answer"],
            }
            for card in existing_cards
        ],
        ensure_ascii=False,
    )

    return f"""
{source_text}

Already generated flashcards:
{existing_summary}

Generate exactly {requested_count} NEW flashcards only.
Do not repeat or restate any existing flashcard.
Return only the missing cards in the same JSON schema.
"""


def generate_exact_flashcard_deck(
    source_text: str,
    expected_count: int,
    fallback_title: str,
) -> Dict[str, Any]:
    collected_cards: List[Dict[str, Any]] = []
    seen_cards = set()
    deck_title = fallback_title
    last_error: Optional[Exception] = None

    for attempt in range(4):
        remaining = expected_count - len(collected_cards)
        if remaining <= 0:
            break

        prompt = build_flashcard_generation_prompt(
            source_text,
            remaining,
            collected_cards,
        )

        try:
            raw = openai_generate_flashcard(prompt, remaining)
            print(f"RAW LLM RESPONSE ATTEMPT {attempt + 1}:", repr(raw))
            parsed = parse_flashcard_json(raw)
            normalized = normalize_flashcard_deck(parsed, fallback_title)
        except Exception as exc:
            last_error = exc
            continue

        if normalized.get("title"):
            deck_title = normalized["title"]

        for card in normalized["cards"]:
            dedupe_key = (card["question"].casefold(), card["answer"].casefold())
            if dedupe_key in seen_cards:
                continue
            seen_cards.add(dedupe_key)
            collected_cards.append(card)
            if len(collected_cards) == expected_count:
                break

    if len(collected_cards) < expected_count:
        if last_error is not None:
            raise ValueError(
                f"AI returned only {len(collected_cards)} unique flashcards out of {expected_count}. "
                f"Last error: {last_error}"
            )
        raise ValueError(
            f"AI returned only {len(collected_cards)} unique flashcards out of {expected_count}"
        )

    return {
        "title": deck_title,
        "cards": collected_cards[:expected_count],
    }

@app.post("/generate-flashcard-topic")
async def generate_flashcard_from_topic(
    payload: TopicFlashcardRequest,
    user_claims: dict = Depends(validate_token)
):
    topic = payload.topic.strip()

    if len(topic) < 5:
        raise HTTPException(422, "Topic is too short")
    if payload.num_cards < 1 or payload.num_cards > 100:
        raise HTTPException(422, "Number of flashcards must be between 1 and 100")

    # 🔹 Prompt engineering — IMPORTANT
    prompt = f"""
You are an expert tutor.

Generate a flashcard deck for the following topic:
"{topic}"

Rules:
- Output VALID JSON ONLY
- No markdown
- No commentary
"""
    if payload.subject_category == "quantitative":
        prompt += """
- For quantitative subjects, the "question" side should present a specific calculation-based problem with concrete numerical values and units.
- The "answer" side should show the worked solution steps and final numerical answer.
- Difficulty should map to computational complexity.
"""
    prompt += f"""
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

    try:
        deck = generate_exact_flashcard_deck(
            prompt,
            payload.num_cards,
            topic,
        )
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
    if num_cards < 1 or num_cards > 100:
        raise HTTPException(422, "Number of flashcards must be between 1 and 100")

    file_path = f"./temp_{uuid.uuid4()}.pdf"
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())

        try:
            extracted_text = extract_text_from_pdf(file_path)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(500, str(exc)) from exc

        if len(extracted_text.strip()) < 50:
            raise HTTPException(422, "PDF has too little readable text to create flashcards")

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    try:
        deck = generate_exact_flashcard_deck(
            extracted_text,
            num_cards,
            "Generated Deck",
        )
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
                body=existing_mindmap,
                partition_key=user_claims["sub"],
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


# ----- Generic Save to Folder -----
@app.post("/save-to-folder")
async def save_to_folder(
    request: Dict[str, Any] = Body(...),
    user_claims: dict = Depends(validate_token)
):
    """Generic endpoint to save any content item to a folder."""
    try:
        user_id = user_claims["sub"]

        title = request.get("title", "Untitled")
        description = request.get("description", "")
        content_type = request.get("contentType", "note")
        folder_id = request.get("folderId")
        data = request.get("data", {})

        document = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "title": title,
            "description": description,
            "contentType": content_type,
            "data": data,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }

        if folder_id:
            document["folderId"] = folder_id

        container.create_item(body=document)

        return {"id": document["id"], "message": "Item saved successfully"}
    except Exception as e:
        print(f"Error saving item to folder: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save item: {str(e)}")


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
            query = "SELECT * FROM c WHERE c.userId = @userId AND c.folderId = @folderId AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false)"
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
    
    # FolderOut requires non-null str for id/name/color/createdAt; legacy docs may omit fields
    created_at = doc.get("createdAt")
    if created_at is not None and not isinstance(created_at, str):
        created_at = str(created_at)
    if not created_at:
        created_at = ""

    return {
        "id": str(folder_id) if folder_id is not None else "",
        "name": str(data.get("name") or ""),
        "color": str(data.get("color") or "blue"),
        "parentFolderId": data.get("parentFolderId"),
        "starred": data.get("starred", False),
        "createdAt": created_at,
        "updatedAt": data.get("updatedAt"),
        "items": items_count,
    }

def _get_descendant_folder_ids(folder_id: str, user_id: str) -> set:
    """Recursively collect all descendant folder IDs for a given folder."""
    descendants = set()
    try:
        query = "SELECT c.id FROM c WHERE c.userId = @userId AND c.contentType = 'folder' AND c.data.parentFolderId = @parentId"
        parameters = [
            {"name": "@userId", "value": user_id},
            {"name": "@parentId", "value": folder_id}
        ]
        children = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        for child in children:
            child_id = child["id"]
            descendants.add(child_id)
            descendants.update(_get_descendant_folder_ids(child_id, user_id))
    except Exception as e:
        print(f"Error getting descendant folders for {folder_id}: {e}")
    return descendants

@app.get("/folders", response_model=List[FolderOut])
async def list_folders(user_claims: dict = Depends(validate_token)):
    """Get all folders for the authenticated user."""
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'folder' AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false) ORDER BY c.createdAt DESC"
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
        if body.starred is not None:
            data["starred"] = body.starred

        data["updatedAt"] = datetime.utcnow().isoformat()
        container.replace_item(
            item=folder_id, body=doc, partition_key=user_claims["sub"]
        )
        return _map_folder_doc_to_out(doc, user_claims["sub"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to update folder")

@app.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    cascade: bool = Query(True, description="If true, soft-delete subfolders and items. If false, fail if folder has children."),
    user_claims: dict = Depends(validate_token)
):
    """Soft-delete a folder. Items and subfolders are marked as deleted, not permanently removed."""
    try:
        doc = container.read_item(item=folder_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"] or doc.get("contentType") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        descendant_ids = _get_descendant_folder_ids(folder_id, user_claims["sub"])
        all_folder_ids = {folder_id} | descendant_ids
        
        if not cascade and descendant_ids:
            raise HTTPException(status_code=409, detail="Folder has subfolders. Use cascade=true to delete.")
        
        deleted_at = datetime.utcnow().isoformat()
        batch_id = str(uuid.uuid4())
        soft_deleted_items = 0
        soft_deleted_subfolders = 0
        
        for fid in all_folder_ids:
            try:
                items_query = "SELECT * FROM c WHERE c.userId = @userId AND c.folderId = @folderId AND c.contentType != 'folder' AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false)"
                items_params = [
                    {"name": "@userId", "value": user_claims["sub"]},
                    {"name": "@folderId", "value": fid}
                ]
                items_in_folder = list(container.query_items(query=items_query, parameters=items_params, enable_cross_partition_query=True))
                for item in items_in_folder:
                    item["deleted"] = True
                    item["deletedAt"] = deleted_at
                    item["deletedBatchId"] = batch_id
                    item["updatedAt"] = deleted_at
                    container.replace_item(
                        item=item["id"], body=item, partition_key=user_claims["sub"]
                    )
                    soft_deleted_items += 1
            except Exception as e:
                print(f"Error soft-deleting items from folder {fid}: {e}")
            
            if fid != folder_id:
                try:
                    subfolder_doc = container.read_item(item=fid, partition_key=user_claims["sub"])
                    if subfolder_doc.get("contentType") != "folder":
                        continue
                    subfolder_doc["deleted"] = True
                    subfolder_doc["deletedAt"] = deleted_at
                    subfolder_doc["deletedBatchId"] = batch_id
                    container.replace_item(
                        item=fid, body=subfolder_doc, partition_key=user_claims["sub"]
                    )
                    soft_deleted_subfolders += 1
                except Exception as e:
                    print(f"Error soft-deleting subfolder {fid}: {e}")
        
        doc["deleted"] = True
        doc["deletedAt"] = deleted_at
        doc["deletedBatchId"] = batch_id
        container.replace_item(
            item=folder_id, body=doc, partition_key=user_claims["sub"]
        )

        return {"ok": True, "soft_deleted_items": soft_deleted_items, "soft_deleted_subfolders": soft_deleted_subfolders}
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
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.folderId = @folderId AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false)"
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


@app.get("/items/unfiled")
async def get_unfiled_items(
    content_type: Optional[str] = Query(None, description="Filter by content type"),
    user_claims: dict = Depends(validate_token)
):
    """Get all items that are not in any folder."""
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType != 'folder' AND c.contentType != 'shared_link' AND (NOT IS_DEFINED(c.folderId) OR IS_NULL(c.folderId)) AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false)"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]

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
    except Exception as e:
        print(f"Error fetching unfiled items: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch unfiled items")


@app.get("/items/{item_id}")
async def get_item(item_id: str, user_claims: dict = Depends(validate_token)):
    """Get a single item by ID, verifying ownership."""
    try:
        doc = container.read_item(item=item_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return doc
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Item not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching item: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch item")


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
        container.replace_item(
            item=item_id, body=doc, partition_key=user_claims["sub"]
        )

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
# Trash / Recently Deleted Endpoints
# --------------------------------------------------------------------------------------

@app.get("/trash")
async def list_trash(user_claims: dict = Depends(validate_token)):
    """Get all soft-deleted items for the user."""
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.deleted = true ORDER BY c.deletedAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return items
    except Exception as e:
        print(f"Error fetching trash: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch trash")

@app.post("/trash/{item_id}/restore")
async def restore_from_trash(item_id: str, user_claims: dict = Depends(validate_token)):
    """Restore a soft-deleted item. For folders, restores all items in the same deletion batch."""
    try:
        doc = container.read_item(item=item_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if not doc.get("deleted"):
            raise HTTPException(status_code=400, detail="Item is not deleted")
        
        batch_id = doc.get("deletedBatchId")
        restored_count = 0
        
        if doc.get("contentType") == "folder" and batch_id:
            batch_query = "SELECT * FROM c WHERE c.userId = @userId AND c.deletedBatchId = @batchId AND c.deleted = true"
            batch_params = [
                {"name": "@userId", "value": user_claims["sub"]},
                {"name": "@batchId", "value": batch_id}
            ]
            batch_items = list(container.query_items(query=batch_query, parameters=batch_params, enable_cross_partition_query=True))
            for batch_item in batch_items:
                batch_item.pop("deleted", None)
                batch_item.pop("deletedAt", None)
                batch_item.pop("deletedBatchId", None)
                batch_item["updatedAt"] = datetime.utcnow().isoformat()
                container.replace_item(
                    item=batch_item["id"],
                    body=batch_item,
                    partition_key=user_claims["sub"],
                )
                restored_count += 1
        
        doc.pop("deleted", None)
        doc.pop("deletedAt", None)
        doc.pop("deletedBatchId", None)
        doc["updatedAt"] = datetime.utcnow().isoformat()
        
        if doc.get("contentType") == "folder":
            parent_id = doc.get("data", {}).get("parentFolderId")
            if parent_id:
                try:
                    container.read_item(item=parent_id, partition_key=user_claims["sub"])
                except Exception:
                    data = doc.setdefault("data", {})
                    data["parentFolderId"] = None
        
        container.replace_item(
            item=item_id, body=doc, partition_key=user_claims["sub"]
        )
        restored_count += 1
        
        return {"message": "Restored successfully", "restored_count": restored_count}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error restoring item: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore item")

@app.delete("/trash/{item_id}")
async def permanently_delete(item_id: str, user_claims: dict = Depends(validate_token)):
    """Permanently delete a trashed item."""
    try:
        doc = container.read_item(item=item_id, partition_key=user_claims["sub"])
        if doc.get("userId") != user_claims["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        batch_id = doc.get("deletedBatchId")
        deleted_count = 0
        
        if doc.get("contentType") == "folder" and batch_id:
            batch_query = "SELECT * FROM c WHERE c.userId = @userId AND c.deletedBatchId = @batchId AND c.deleted = true"
            batch_params = [
                {"name": "@userId", "value": user_claims["sub"]},
                {"name": "@batchId", "value": batch_id}
            ]
            batch_items = list(container.query_items(query=batch_query, parameters=batch_params, enable_cross_partition_query=True))
            for batch_item in batch_items:
                container.delete_item(item=batch_item["id"], partition_key=user_claims["sub"])
                deleted_count += 1
        
        container.delete_item(item=item_id, partition_key=user_claims["sub"])
        deleted_count += 1
        
        return {"message": "Permanently deleted", "deleted_count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error permanently deleting: {e}")
        raise HTTPException(status_code=500, detail="Failed to permanently delete")

@app.delete("/trash")
async def empty_trash(user_claims: dict = Depends(validate_token)):
    """Permanently delete all trashed items for the user."""
    try:
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.deleted = true"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        
        deleted_count = 0
        for item in items:
            try:
                container.delete_item(item=item["id"], partition_key=user_claims["sub"])
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting item {item.get('id')}: {e}")
        
        return {"message": f"Emptied trash", "deleted_count": deleted_count}
    except Exception as e:
        print(f"Error emptying trash: {e}")
        raise HTTPException(status_code=500, detail="Failed to empty trash")

# --------------------------------------------------------------------------------------
# Study Streak API
# --------------------------------------------------------------------------------------

def _study_date_from_request(request: Request):
    study_date = (request.headers.get("X-Study-Date") or "").strip()
    if study_date:
        try:
            return datetime.strptime(study_date[:10], "%Y-%m-%d").date()
        except ValueError:
            pass
    return datetime.utcnow().date()


def _parse_study_date(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


MEANINGFUL_STREAK_ACTIVITY = "meaningful_tool_action"
STREAK_ACTION_KEYS = {
    "flashcard_deck": {
        "generate_flashcards",
        "save_flashcard_deck",
        "update_flashcard_deck",
    },
    "mind_map": {
        "create_mind_map",
        "save_mind_map",
        "update_mind_map",
    },
    "quiz": {
        "complete_quiz",
        "generate_quiz",
        "save_quiz",
        "save_quiz_attempt",
    },
    "study_plan": {
        "generate_study_plan",
        "update_study_plan",
    },
    "summarizer": {
        "generate_summary",
        "save_summary",
    },
    "voice_note": {
        "save_voice_note",
    },
}


def _is_meaningful_streak_action(tool_key: Optional[str], action_key: Optional[str]) -> bool:
    return action_key in STREAK_ACTION_KEYS.get(tool_key or "", set())


def _is_meaningful_streak_doc(doc: Dict[str, Any]) -> bool:
    return (
        doc.get("lastActivityType") == MEANINGFUL_STREAK_ACTIVITY
        and _is_meaningful_streak_action(
            doc.get("lastToolKey"),
            doc.get("lastActionKey"),
        )
    )


def _current_streak_for_date(doc: Dict[str, Any], today):
    if not _is_meaningful_streak_doc(doc):
        return 0
    last_date = _parse_study_date(doc.get("lastStudyDate"))
    if last_date and (today - last_date).days > 1:
        return 0
    return doc.get("streakDays", 0)


@app.get("/streak")
async def get_streak(request: Request, user_claims: dict = Depends(validate_token)):
    uid = user_claims["sub"]

    query = "SELECT * FROM c WHERE c.userId = @uid AND c.contentType = 'study_streak'"
    params = [{"name": "@uid", "value": uid}]

    items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

    if not items:
        return {"current_streak": 0}

    doc = items[0]
    last_date_str = doc.get("lastStudyDate")
    streak = doc.get("streakDays", 0)

    if not _is_meaningful_streak_doc(doc):
        return {"current_streak": 0}

    if last_date_str:
        last_date = _parse_study_date(last_date_str)
        today = _study_date_from_request(request)
        diff = (today - last_date).days if last_date else 0

        if diff > 1:
            return {"current_streak": 0}

    return {"current_streak": streak}


@app.post("/update-streak")
async def update_streak(request: Request, user_claims: dict = Depends(validate_token)):
    uid = user_claims["sub"]

    query = "SELECT * FROM c WHERE c.userId = @uid AND c.contentType = 'study_streak'"
    params = [{"name": "@uid", "value": uid}]

    items = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

    today = _study_date_from_request(request)
    today_str = today.isoformat()
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    activity_type = payload.get("activityType") or payload.get("activity_type")
    tool_key = payload.get("toolKey") or payload.get("tool_key")
    action_key = payload.get("actionKey") or payload.get("action_key")

    if activity_type != MEANINGFUL_STREAK_ACTIVITY or not _is_meaningful_streak_action(tool_key, action_key):
        if not items:
            return {"current_streak": 0, "streak_updated": False}
        doc = items[0]
        return {
            "current_streak": _current_streak_for_date(doc, today),
            "streak_updated": False
        }

    if not items:
        doc = {
            "id": str(uuid.uuid4()),
            "userId": uid,
            "contentType": "study_streak",
            "streakDays": 1,
            "lastStudyDate": today_str,
            "lastActivityType": MEANINGFUL_STREAK_ACTIVITY,
            "lastToolKey": tool_key,
            "lastActionKey": action_key,
            "updatedAt": datetime.utcnow().isoformat()
        }
        container.create_item(body=doc)
        return {"current_streak": 1, "previous_streak": 0, "streak_updated": True}

    doc = items[0]

    if not _is_meaningful_streak_doc(doc):
        doc["streakDays"] = 1
        doc["lastStudyDate"] = today_str
        doc["lastActivityType"] = MEANINGFUL_STREAK_ACTIVITY
        doc["lastToolKey"] = tool_key
        doc["lastActionKey"] = action_key
        doc["updatedAt"] = datetime.utcnow().isoformat()
        container.upsert_item(doc)
        return {"current_streak": 1, "previous_streak": 0, "streak_updated": True}

    last_date_str = doc.get("lastStudyDate")
    streak = doc.get("streakDays", 0)
    previous_streak = streak

    if last_date_str:
        last_date = _parse_study_date(last_date_str)
        diff = (today - last_date).days if last_date else None
    else:
        diff = None

    if diff is not None and diff <= 0:
        return {
            "current_streak": streak,
            "previous_streak": previous_streak,
            "streak_updated": False
        }

    elif diff == 1:
        streak += 1

    else:
        previous_streak = 0
        streak = 1

    doc["streakDays"] = streak
    doc["lastStudyDate"] = today_str
    doc["lastActivityType"] = MEANINGFUL_STREAK_ACTIVITY
    doc["lastToolKey"] = tool_key
    doc["lastActionKey"] = action_key
    doc["updatedAt"] = datetime.utcnow().isoformat()

    container.upsert_item(doc)

    return {
        "current_streak": streak,
        "previous_streak": previous_streak,
        "streak_updated": True
    }

# --------------------------------------------------------------------------------------
# Dev server
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
