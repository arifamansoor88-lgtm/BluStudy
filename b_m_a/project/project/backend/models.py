from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime

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

class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str
    starred: bool = False
    items: int = 0

class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    color: Optional[str] = None
    starred: Optional[bool] = None
    items: Optional[int] = None  # keep in sync with your tools count

class FolderOut(BaseModel):
    id: str
    name: str
    color: str
    starred: bool
    items: int
    createdAt: str
    updatedAt: Optional[str] = None
class Folder(BaseModel):
    id: Optional[str] = None
    name: str
    color: str
    starred: bool = False
    items: int = 0  # total items in this folder (kept in sync by client)
    contentType: Literal["folder"] = "folder"

class CreateFolderRequest(BaseModel):
    name: str
    color: str
    starred: bool = False

class UpdateFolderRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    starred: Optional[bool] = None
    items: Optional[int] = None