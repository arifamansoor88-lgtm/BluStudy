from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# =========================
# Voice Notes (tags-based)
# =========================

class VoiceNoteResponse(BaseModel):
    id: str
    userId: str
    contentType: str = "voice_note"
    title: Optional[str] = None
    text: str = ""
    tags: List[str] = Field(default_factory=list)
    duration: Optional[int] = None
    visibility: str = "Private"  # "Private" | "Public"
    timestamp: str
    audio_url: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


# =========================
# Quiz models
# =========================

class QuizOptions(BaseModel):
    numQuestions: int
    selectedTopics: List[str] = Field(default_factory=list)
    customTopics: Optional[str] = None
    questionFormats: Dict[str, Any] = Field(default_factory=dict)

class QuizData(BaseModel):
    title: str
    questions: Any  # keep flexible; AI output varies
    userAnswers: Optional[Any] = None
    score: Optional[float] = None
    timeTaken: int = 0
    resourceName: Optional[str] = None
    options: QuizOptions
    attempts: List[Dict[str, Any]] = Field(default_factory=list)

class QuizDocument(BaseModel):
    contentType: str = "quiz"
    data: QuizData

class SavedQuizResponse(BaseModel):
    id: str
    message: str

class QuizAttempt(BaseModel):
    attemptId: str
    timestamp: str
    score: Optional[float] = None
    timeTaken: int
    userAnswers: Any
    mode: Optional[str] = None

class SaveQuizAttemptRequest(BaseModel):
    quizId: str
    score: Optional[float] = None
    timeTaken: int
    userAnswers: Any
    mode: Optional[str] = None

class SaveQuizAttemptResponse(BaseModel):
    quizId: str
    attemptId: str
    message: str


# =========================
# Study plan models
# =========================

class StudyPlanData(BaseModel):
    title: str
    description: str = ""
    content: Any  # AI-generated structure; keep flexible
    tags: List[str] = Field(default_factory=list)
    pdfs: List[str] = Field(default_factory=list)
    duration_info: Optional[Dict[str, Any]] = None
    updatedAt: Optional[str] = None

class StudyPlanDocument(BaseModel):
    contentType: str = "study_plan"
    data: StudyPlanData

class SaveStudyPlanResponse(BaseModel):
    id: str
    message: str

class UpdateStudyPlanRequest(BaseModel):
    planId: str
    quizIds: List[str] = Field(default_factory=list)

class UpdateStudyPlanResponse(BaseModel):
    id: str
    message: str
    updatedPlan: Any
