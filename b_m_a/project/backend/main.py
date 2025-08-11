import os
import json
import uuid
import uvicorn
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, HTTPException, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional, Union
import msal
from jose import jwt
from database import client, container  
from pdf_utils import extract_text_from_pdf
from openai_client import generate_quiz, generate_answer_explanation, evaluate_short_answer, generate_study_plan, update_study_plan, summarize_text
from models import QuizDocument, SavedQuizResponse, SaveQuizAttemptRequest, SaveQuizAttemptResponse, QuizAttempt, StudyPlanDocument, SaveStudyPlanResponse, UpdateStudyPlanRequest, UpdateStudyPlanResponse, Flashcard, FlashcardDeck, SaveFlashcardResponse, FlashcardDocument 
from pydantic import BaseModel

# Load the environment variables
load_dotenv()

# Create FastAPI app instance
app = FastAPI(title="Blue Marble Academy API")

# Add CORS middleware to allow the frontend React app to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

# OAuth2 scheme to extract the token from the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Configure the MSAL client for validating tokens
def get_msal_app():
    return msal.ConfidentialClientApplication(
        client_id=os.getenv("CLIENT_ID"),
        authority=os.getenv("AUTHORITY"),
        client_credential=os.getenv("CLIENT_SECRET")
    )

# Validate the JWT token from Azure AD B2C
async def validate_token(token: str = Depends(oauth2_scheme)):
    try:
        # we're skipping proper token validation for now
        # We'd need to verify the token properly against Azure AD B2C's public key
        # Use a dummy key for development
        dummy_key = "development_key_not_for_production"
        
        # Use options to skip signature verification for development
        decoded_token = jwt.decode(
            token,
            key=dummy_key,  # Using a dummy key since we're not verifying the signature
            options={
                "verify_signature": False,  # Skip signature verification for development
                "verify_aud": False,        # Skip audience verification
                "verify_exp": False         # Skip expiration verification
            }
        )
        
        # Check if token contains expected claims
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

# Root endpoint - public
@app.get("/")
def read_root():
    return {"message": "Backend is running and connected to Cosmos DB!"}

# PDF upload and quiz generation endpoint - protected
@app.post("/generate-quiz")
async def create_quiz(
    file: UploadFile = File(...), 
    num_questions: Optional[int] = Form(10),
    focus_topics: Optional[str] = Form(""),
    question_formats: Optional[str] = Form("{}"),
    user_claims: dict = Depends(validate_token)
):
    try:
        # Save the uploaded file temporarily
        file_path = f"./temp_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        # Extract text from the PDF
        text = extract_text_from_pdf(file_path)
        
        # Parse question formats from string to dict
        try:
            formats_dict = json.loads(question_formats)
        except:
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
            
        # Generate quiz using Azure OpenAI with customization options
        quiz_json = generate_quiz(
            text=text,
            num_questions=num_questions,
            focus_topics=focus_topics.strip(),
            question_formats=selected_formats
        )
        
        # Clean up the temporary file
        if os.path.exists(file_path):
            os.remove(file_path)
        
        quiz_data = json.loads(quiz_json)
        
        # Automatically save the quiz
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
        
        # Save to Cosmos DB
        container.create_item(body=quiz_document)
        
        # Return the quiz data with the ID
        quiz_data["id"] = quiz_document["id"]
        return quiz_data
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}"
        )

# Save quiz endpoint - protected 
@app.post("/save-quiz", response_model=SavedQuizResponse)
async def save_quiz(quiz: QuizDocument, user_claims: dict = Depends(validate_token)):
    try:
        # Prepare document for Cosmos DB
        document = {
            "id": str(uuid.uuid4()),
            "userId": user_claims["sub"],  
            "contentType": quiz.contentType,
            "createdAt": datetime.utcnow().isoformat(),
            "data": quiz.data.dict()  
        }
        
        # Save to Cosmos DB
        container.create_item(body=document)
        return {"id": document["id"], "message": "Quiz saved successfully"}
    except Exception as e:
        print(f"Error saving quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save quiz: {str(e)}"
        )

# Save quiz attempt endpoint - protected
@app.post("/save-quiz-attempt", response_model=SaveQuizAttemptResponse)
async def save_quiz_attempt(attempt: SaveQuizAttemptRequest, user_claims: dict = Depends(validate_token)):
    try:
        # First, retrieve the original quiz
        quiz_id = attempt.quizId
        
        try:
            # Get the quiz from Cosmos DB
            quiz = container.read_item(
                item=quiz_id, 
                partition_key=user_claims["sub"]
            )
            
            # Verify the quiz belongs to the user
            if quiz["userId"] != user_claims["sub"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="Access denied"
                )
                
        except Exception as e:
            print(f"Error retrieving quiz: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Quiz not found"
            )
        
        # Create a new attempt record
        attempt_id = str(uuid.uuid4())
        new_attempt = {
            "attemptId": attempt_id,
            "timestamp": datetime.utcnow().isoformat(),
            "score": attempt.score,
            "timeTaken": attempt.timeTaken,
            "userAnswers": attempt.userAnswers,
            "mode": attempt.mode
        }
        
        # Add the attempt to the quiz's attempts array
        if "attempts" not in quiz["data"]:
            quiz["data"]["attempts"] = []
            
        quiz["data"]["attempts"].append(new_attempt)
        
        # Update the quiz in Cosmos DB
        container.replace_item(
            item=quiz_id,
            body=quiz
        )
        
        return {
            "quizId": quiz_id,
            "attemptId": attempt_id,
            "message": "Quiz attempt saved successfully"
        }
        
    except HTTPException as http_e:
        # Re-raise HTTP exceptions
        raise http_e
    except Exception as e:
        print(f"Error saving quiz attempt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to save quiz attempt: {str(e)}"
        )

# Get all quizzes for a user - protected
@app.get("/quizzes")
async def get_quizzes(user_claims: dict = Depends(validate_token)):
    try:
        # Query parameters for Cosmos DB
        query = "SELECT * FROM c WHERE c.userId = @userId AND c.contentType = 'quiz' ORDER BY c.createdAt DESC"
        parameters = [{"name": "@userId", "value": user_claims["sub"]}]
        
        # Query Cosmos DB
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        return items
    except Exception as e:
        print(f"Error fetching quizzes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to fetch quizzes: {str(e)}"
        )

# Get a specific quiz by ID - protected
@app.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the quiz from Cosmos DB (using partition key)
        quiz = container.read_item(
            item=quiz_id, 
            partition_key=user_claims["sub"]
        )
        
        # Verify the quiz belongs to the user
        if quiz["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access denied"
            )
            
        return quiz
    except Exception as e:
        print(f"Error fetching quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Quiz not found"
        )

# Get quiz with attempt history endpoint - protected
@app.get("/quizzes/{quiz_id}/with-history")
async def get_quiz_with_history(quiz_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the quiz from Cosmos DB
        quiz = container.read_item(
            item=quiz_id, 
            partition_key=user_claims["sub"]
        )
        
        # Verify the quiz belongs to the user
        if quiz["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access denied"
            )
            
        return quiz
    except Exception as e:
        print(f"Error fetching quiz with history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Quiz not found"
        )

# Health check endpoint - public
@app.get("/health")
def health_check():
    return {"status": "healthy"}

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
        # Validate inputs
        if not files:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No files provided"
            )
            
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title is required"
            )
        
        # Process all files and extract text
        all_text = ""
        pdf_names = []
        
        for file in files:
            try:
                # Validate file type
                if not file.filename.lower().endswith('.pdf'):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"File {file.filename} is not a PDF"
                    )
                
                # Save the uploaded file temporarily
                file_path = f"./temp_{file.filename}"
                try:
                    with open(file_path, "wb") as f:
                        f.write(await file.read())
                except Exception as file_write_error:
                    print(f"Error writing file: {str(file_write_error)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Error saving uploaded file: {str(file_write_error)}"
                    )
                
                # Extract text from the PDF
                try:
                    text = extract_text_from_pdf(file_path)
                    all_text += text + "\n\n"
                    pdf_names.append(file.filename)
                except Exception as text_extract_error:
                    print(f"Error extracting PDF text: {str(text_extract_error)}")
                    # Continue with a warning instead of failing
                    all_text += f"[Failed to extract text from {file.filename}]\n\n"
                    pdf_names.append(file.filename)
                
                # Clean up the temporary file
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as cleanup_error:
                        print(f"Error cleaning up file: {str(cleanup_error)}")
                        # Continue without failing
            except HTTPException:
                # Re-raise HTTP exceptions
                raise
            except Exception as file_error:
                print(f"Error processing file {file.filename}: {str(file_error)}")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Error processing file {file.filename}: {str(file_error)}"
                )
        
        # Check if we have any text to process
        if not all_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract any text from the provided PDFs"
            )
        
        # Parse tags list
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
        
        # Parse duration metadata if provided
        duration_info = None
        if duration_metadata:
            try:
                duration_info = json.loads(duration_metadata)
                print(f"Duration info provided: {duration_info}")
            except json.JSONDecodeError:
                print(f"Invalid duration metadata format: {duration_metadata}")
                # Continue without failing - we'll use it as a string if needed
        
        # Generate study plan using Azure OpenAI
        try:
            study_plan_json = generate_study_plan(
                text=all_text,
                title=title,
                tags=tag_list,
                duration_info=duration_info
            )
        except Exception as openai_error:
            print(f"Error calling OpenAI: {str(openai_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generating study plan with AI: {str(openai_error)}"
            )
        
        # Parse the generated JSON
        try:
            study_plan_data = json.loads(study_plan_json)
        except json.JSONDecodeError as json_error:
            print(f"Error parsing AI response: {str(json_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error parsing AI response. The generated study plan was not valid JSON."
            )
        
        # Automatically save the study plan
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
                "duration_info": duration_info,  # Save duration info in the document
                "updatedAt": None
            }
        }
        
        # Save to Cosmos DB
        try:
            container.create_item(body=study_plan_document)
        except Exception as db_error:
            print(f"Error saving to database: {str(db_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving study plan to database: {str(db_error)}"
            )
        
        # Return the study plan data with the ID
        return {
            "id": study_plan_document["id"],
            "plan": study_plan_data,
            "message": "Study plan created successfully"
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Error generating study plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate study plan: {str(e)}"
        )

# Get study plans endpoint - protected
@app.get("/study-plans")
async def get_study_plans(user_claims: dict = Depends(validate_token)):
    try:
        # Query all study plans for the user
        query = f"SELECT * FROM c WHERE c.userId = '{user_claims['sub']}' AND c.contentType = 'study_plan' ORDER BY c.createdAt DESC"
        
        items = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        
        # Format the response
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve study plans: {str(e)}"
        )

# Get a specific study plan - protected
@app.get("/study-plans/{plan_id}")
async def get_study_plan(plan_id: str, user_claims: dict = Depends(validate_token)):
    try:
        # Get the study plan from Cosmos DB
        study_plan = container.read_item(
            item=plan_id, 
            partition_key=user_claims["sub"]
        )
        
        # Verify the plan belongs to the user
        if study_plan["userId"] != user_claims["sub"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Access denied"
            )
            
        return study_plan
    except Exception as e:
        print(f"Error retrieving study plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Study plan not found"
        )

# Update a study plan based on quiz results - protected
@app.post("/update-study-plan", response_model=UpdateStudyPlanResponse)
async def update_study_plan_endpoint(request: UpdateStudyPlanRequest, user_claims: dict = Depends(validate_token)):
    try:
        # Get the original study plan
        plan_id = request.planId
        
        try:
            # Get the study plan from Cosmos DB
            study_plan = container.read_item(
                item=plan_id, 
                partition_key=user_claims["sub"]
            )
            
            # Verify the plan belongs to the user
            if study_plan["userId"] != user_claims["sub"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="Access denied"
                )
                
        except Exception as e:
            print(f"Error retrieving study plan: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Study plan not found"
            )
        
        # Collect quiz attempt data
        quiz_results = []
        for quiz_id in request.quizIds:
            try:
                # Get quiz with history
                quiz = container.read_item(
                    item=quiz_id, 
                    partition_key=user_claims["sub"]
                )
                
                # Skip if no attempts are available
                if not quiz["data"].get("attempts"):
                    continue
                
                # Get the most recent attempt
                latest_attempt = max(quiz["data"]["attempts"], key=lambda x: x["timestamp"])
                
                # Add to results with quiz info
                quiz_results.append({
                    "quizId": quiz_id,
                    "title": quiz["data"].get("title", ""),
                    "score": latest_attempt.get("score"),
                    "timestamp": latest_attempt.get("timestamp"),
                    "questions": quiz["data"].get("questions"),
                    "userAnswers": latest_attempt.get("userAnswers"),
                    "tags": study_plan["data"]["tags"]  # Use the study plan tags
                })
                
            except Exception as e:
                print(f"Error retrieving quiz {quiz_id}: {str(e)}")
                # Continue with other quizzes even if one fails
                continue
        
        # Update the study plan
        updated_plan_json = update_study_plan(
            original_plan=study_plan["data"]["content"],
            quiz_results=quiz_results
        )
        
        # Parse the updated JSON
        updated_plan_data = json.loads(updated_plan_json)
        
        # Update the study plan document
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
        print(f"❌ Error during processing: {e}")  # <- THIS is what we need to see
        raise HTTPException(status_code=500, detail=str(e))

    return {"summary": summary}
# For development purposes
if __name__ == "__main__":
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

