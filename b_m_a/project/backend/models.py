from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class Flashcard(BaseModel):
    question: str
    answer: str

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
    questions: List[Dict[str, Any]]
    userAnswers: Optional[List[Any]] = None
    score: Optional[float] = None
    timeTaken: Optional[int] = None
    resourceName: str
    options: QuizOptions
    attempts: Optional[List[QuizAttempt]] = []
    originalQuizId: Optional[str] = None
    # New fields for enhanced save functionality
    testProgress: Optional[TestProgress] = None
    savedAnswers: Optional[List[SavedAnswer]] = []
    
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

class SaveTestProgressRequest(BaseModel):
    """Request model for saving test progress"""
    quizId: str
    currentQuestion: int
    userAnswers: List[Any]
    timeElapsed: int
    isCompleted: bool = False

class SaveTestProgressResponse(BaseModel):
    """Response model for saving test progress"""
    quizId: str
    message: str
    lastSaved: str

class SaveAnswerRequest(BaseModel):
    """Request model for saving individual answers"""
    quizId: str
    questionIndex: int
    userAnswer: Any
    isCorrect: bool
    explanation: Optional[str] = None
    timeSpent: Optional[int] = None

class SaveAnswerResponse(BaseModel):
    """Response model for saving individual answers"""
    quizId: str
    answerId: str
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
