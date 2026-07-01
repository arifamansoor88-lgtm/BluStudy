# BluStudy Backend

FastAPI backend for the BluStudy platform. Handles AI generation, data storage, authentication, and study streak tracking.

## Setup

### 1. Create and activate a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your credentials (see `.env.example` for descriptions).

### 4. Run the server

```bash
uvicorn main:app --reload
```

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Environment Variables

See `.env.example` for the full list. Required variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (used for all AI features) |
| `COSMOS_DB_URL` | Azure Cosmos DB endpoint |
| `COSMOS_DB_KEY` | Azure Cosmos DB key |
| `CLIENT_ID` | Azure AD B2C application client ID |
| `CLIENT_SECRET` | Azure AD B2C client secret |
| `AUTHORITY` | Azure AD B2C authority URL |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage (voice notes) |
| `FRONTEND_ORIGINS` | Comma-separated allowed CORS origins |

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | All API routes |
| `openai_client.py` | OpenAI calls — quiz, flashcard, summarizer, study plan, answer evaluation |
| `database.py` | Azure Cosmos DB helpers |
| `models.py` | Pydantic request/response models |
| `pdf_utils.py` | PDF text extraction (PyMuPDF) |
| `runtime.txt` | Pins Python to 3.11.9 for Render |

## AI Model

All AI features use `gpt-4o-mini` via the standard OpenAI SDK. The client is initialized in `openai_client.py` using `OPENAI_API_KEY`.

## Authentication

Protected endpoints require a valid Azure AD B2C JWT passed as:

```
Authorization: Bearer <token>
```

Tokens are validated on every request. The frontend (MSAL) acquires tokens silently and passes them automatically.

## Adding Dependencies

When you install a new package, pin the version in `requirements.txt`:

```bash
pip install some-package
pip show some-package   # check the version
# then add "some-package==x.y.z" to requirements.txt
```

## Deployment (Render)

- Runtime: Python 3.11 (pinned via `runtime.txt`)
- Root directory must be set to `project/backend` in Render service settings
- All environment variables must be added in the Render dashboard under **Environment**
