# BluStudy

**Live app: https://blustudy-app.onrender.com/**

An AI-powered study platform that helps students learn more effectively with flashcards, practice tests, mind maps, summaries, voice notes, and personalized study plans.

## Features

- **AI Flashcards** — generate flashcard decks from uploaded PDFs or text
- **Practice Tests** — multi-format quizzes (multiple choice, multi-select, drag-and-drop, short answer, fill-in-blank, numerical) with LaTeX math support
- **Quizio** — AI analyzes past quiz scores to identify weak topics and builds targeted practice sets
- **AI Summarizer** — condense documents or text into bullet points, key points, or Q&A pairs
- **Mind Maps** — interactive visual mind maps with AI generation
- **Voice Notes** — record, store, and review audio notes
- **Study Planner** — generate structured multi-week study plans from uploaded materials
- **Workspace** — organize all your content into folders, with soft-delete trash
- **Dashboard** — study streak tracking, recent items, and AI-suggested next steps
- **Guest mode** — limited access to flashcards, practice tests, and summarizer without signing in
- **Share links** — share individual items with others

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI (Python 3.11) |
| Auth | Azure AD B2C (MSAL) |
| Database | Azure Cosmos DB |
| AI | OpenAI (`gpt-4o-mini`) |
| Storage | Azure Blob Storage (voice notes) |
| Deployment | Render (frontend: Static Site, backend: Web Service) |

## Project Structure

```
project/
├── backend/              # FastAPI backend
│   ├── main.py           # API routes
│   ├── openai_client.py  # OpenAI integration (quiz, flashcard, summarizer, study plan)
│   ├── database.py       # Cosmos DB helpers
│   ├── models.py         # Pydantic models
│   ├── pdf_utils.py      # PDF text extraction
│   ├── requirements.txt
│   ├── runtime.txt       # Python 3.11.9
│   └── .env.example      # Environment variable template
├── src/
│   ├── api/
│   │   └── apiService.js # Centralized API calls + study streak logic
│   ├── components/       # Navbar, Sidebar, GuestBanner
│   ├── context/          # GuestContext
│   ├── hooks/            # useUserRecents
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── StudyTools.jsx
│   │   ├── Workspace.jsx / FolderView.jsx / Trash.jsx
│   │   ├── Settings.jsx
│   │   └── tools/        # AIFlashcards, PracticeTests, MindMaps, VoiceNotes, StudyPlans, summarizer
│   ├── App.jsx
│   ├── authConfig.js     # MSAL / Azure B2C config
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- An OpenAI API key
- Azure AD B2C tenant (for auth)
- Azure Cosmos DB (for data)

### 1. Clone the repo

```bash
git clone https://github.com/BlueMarbleAcademy/ai_education.git
cd ai_education/project
```

### 2. Frontend setup

```bash
npm install
```

Create a `.env` file in `project/`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
# Runs on http://localhost:5173
```

### 3. Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Start the backend:

```bash
uvicorn main:app --reload
# Runs on http://localhost:8000
# API docs: http://localhost:8000/docs
```

## Environment Variables

### Frontend (`project/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend URL (e.g. `http://localhost:8000`) |

### Backend (`project/backend/.env`)

See [`backend/.env.example`](backend/.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `COSMOS_DB_URL` | Azure Cosmos DB endpoint |
| `COSMOS_DB_KEY` | Azure Cosmos DB key |
| `CLIENT_ID` | Azure AD B2C application client ID |
| `CLIENT_SECRET` | Azure AD B2C client secret |
| `AUTHORITY` | Azure AD B2C authority URL |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string (voice notes) |
| `FRONTEND_ORIGINS` | Comma-separated allowed CORS origins |

## Deployment

The app is deployed on Render:

- **Frontend** — Static Site, auto-deploys from `main` branch
- **Backend** — Web Service (Python 3), root directory: `project/backend`

The backend service requires all environment variables above to be set in the Render dashboard under **Environment**.

## Authentication

Protected routes require a valid Azure AD B2C JWT token. The frontend acquires tokens silently via MSAL and passes them as `Authorization: Bearer <token>` headers. The backend validates tokens on every protected endpoint.

## Contributing

1. Fork the repo and create a branch from `main`
2. Make your changes and test locally
3. Open a pull request — the team reviews before merging to `main`
