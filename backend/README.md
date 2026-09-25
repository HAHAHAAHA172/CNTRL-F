# CNTRL F — Backend

Python + FastAPI backend for the CNTRL F codebase navigator.

## Setup

```bash
# Create and activate the virtual environment (already done)
# Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
The frontend dev server proxies `/api` requests to this port automatically.

## Structure

```
backend/
├── main.py          # FastAPI app + CORS setup
├── routers/         # Route handlers (to be added)
│   ├── analyze.py   # POST /api/analyze — fetch & parse a GitHub repo
│   └── chat.py      # POST /api/chat   — codebase-aware AI chat
├── services/        # Business logic (to be added)
│   ├── github.py    # GitHub API fetching
│   ├── parser.py    # JS/TS import parsing
│   └── ai.py        # AI context + response
├── requirements.txt
└── .env             # GITHUB_TOKEN, AI_API_KEY (not committed)
```
