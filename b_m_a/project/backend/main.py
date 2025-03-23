import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from typing import List, Dict, Any
import msal
import json
from jose import jwt

# Load the environment variables
load_dotenv()

# Create FastAPI app instance
app = FastAPI(title="Blue Marble Academy API")

# Add CORS middleware to allow the frontend React app to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow the frontend React app (Vite uses port 5173 by default)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
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
        # For development/demo purposes only
        # In production, you should properly validate the token with the issuer's public key
        # For Azure AD B2C tokens, we'll just decode without verification for this demo
        
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

# Demo data - in a real app, this would come from a database
DEMO_TASKS = [
    {"id": 1, "title": "Learn FastAPI", "completed": False},
    {"id": 2, "title": "Implement Azure AD B2C Auth", "completed": False},
    {"id": 3, "title": "Connect Frontend to Backend", "completed": False},
]

# Root endpoint - public
@app.get("/")
def read_root():
    return {"message": "Welcome to Blue Marble Academy API"}

# Get all tasks - protected
@app.get("/tasks", response_model=List[Dict[str, Any]])
async def read_tasks(user_claims: dict = Depends(validate_token)):
    # In a real app, you'd fetch tasks from a database for the specific user
    # using the user ID from the token (user_claims["sub"])
    return DEMO_TASKS

# Health check endpoint - public
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# For development purposes
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 