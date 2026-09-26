from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import os

load_dotenv()

cors_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env != "*" else ["*"]

app = FastAPI(title="CNTRL F API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


from routers import analyze, chat, impact, onboarding  # noqa: E402
app.include_router(analyze.router)
app.include_router(chat.router)
app.include_router(impact.router)
app.include_router(onboarding.router)
