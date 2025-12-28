from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class Difficulty(Enum):
    EASY = 1
    MEDUIUM = 2
    HARD = 3

class Flashcard(BaseModel):
    question: str
    answer: str
    difficulty: str
    important: bool

class FlashcardDeck(BaseModel):
    title: str
    cards: List[Flashcard]
    resourceName: Optional[str] = None

class FlashcardDocument(BaseModel):
    contentType: str
    data: FlashcardDeck

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




# Mindmap Models
class MindmapNode(BaseModel):
    id: str
    type: str = "custom"
    position: Dict[str, float]  # {x: float, y: float}
    data: Dict[str, Any]  # label, color, shape, etc.

class MindmapEdge(BaseModel):
    id: str
    source: str
    target: str
    style: Optional[Dict[str, Any]] = None
    type: Optional[str] = "smoothstep"

class MindmapGroup(BaseModel):
    id: str
    type: str = "group"
    position: Dict[str, float]
    data: Dict[str, Any]  # label, color, width, height, contained nodes

class MindmapData(BaseModel):
    title: str
    slug: Optional[str] = None
    nodes: List[MindmapNode]
    edges: List[MindmapEdge]
    groups: Optional[List[MindmapGroup]] = []
    metadata: Optional[Dict[str, Any]] = {}

class MindmapDocument(BaseModel):
    contentType: str = "mindmap"
    data: MindmapData

class SaveMindmapResponse(BaseModel):
    id: str
    slug: str
    message: str

class CreateMindmapRequest(BaseModel):
    title: str


# =========================
# Quiz models
# =========================

class QuizOptions(BaseModel):
    numQuestions: int
    selectedTopics: List[str] = Field(default_factory=list)
    customTopics: Optional[str] = None
    questionFormats: Dict[str, Any] = Field(default_factory=dict)

class TestProgress(BaseModel):
    """Model for saving incomplete test progress"""
    currentQuestion: int
    userAnswers: List[Any]
    timeElapsed: int
    lastSaved: str
    isCompleted: bool = False

class SavedAnswer(BaseModel):
    """Model for saving individual answers with explanations"""
    questionIndex: int
    userAnswer: Any
    isCorrect: bool
    explanation: Optional[str] = None
    timestamp: str
    timeSpent: Optional[int] = None

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
