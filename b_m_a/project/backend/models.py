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

class FlashcardDocument(BaseModel):
    contentType: str
    data: FlashcardDeck

class SaveFlashcardResponse(BaseModel):
    id: str
    message: str

class QuizOptions(BaseModel):
    numQuestions: int
    selectedTopics: List[str]
    customTopics: str
    questionFormats: Dict[str, bool]

class QuizAttempt(BaseModel):
    attemptId: str
    timestamp: str
    score: float
    timeTaken: int
    userAnswers: List[Any]
    mode: str  

class QuizData(BaseModel):
    title: str
    questions: List[Dict[str, Any]]
    userAnswers: Optional[List[Any]] = None
    score: Optional[float] = None
    timeTaken: Optional[int] = None
    resourceName: str
    options: QuizOptions
    attempts: Optional[List[QuizAttempt]] = []
    originalQuizId: Optional[str] = None  
    
class QuizDocument(BaseModel):
    contentType: str
    data: QuizData

class SavedQuizResponse(BaseModel):
    id: str
    message: str

class SaveQuizAttemptRequest(BaseModel):
    quizId: str
    score: float
    timeTaken: int
    userAnswers: List[Any]
    mode: str

class SaveQuizAttemptResponse(BaseModel):
    quizId: str
    attemptId: str
    message: str

class StudyPlanData(BaseModel):
    title: str
    description: str
    content: Dict[str, Any]
    tags: List[str] = []
    pdfs: List[str] = []
    updatedAt: Optional[str] = None

class StudyPlanDocument(BaseModel):
    contentType: str = "study_plan"
    data: StudyPlanData

class SaveStudyPlanResponse(BaseModel):
    id: str
    message: str

class UpdateStudyPlanRequest(BaseModel):
    planId: str
    quizIds: List[str] = []

class UpdateStudyPlanResponse(BaseModel):
    id: str
    message: str
    updatedPlan: Dict[str, Any]

class Summary(BaseModel):
    summary: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
