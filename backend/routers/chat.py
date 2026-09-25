from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai import ask
from routers.analyze import _cache

router = APIRouter()


class ChatRequest(BaseModel):
    repo_url: str
    message: str
    file_context: str | None = None


@router.post("/api/chat")
async def chat(req: ChatRequest):
    cached = _cache.get(req.repo_url)
    if not cached:
        raise HTTPException(
            status_code=400,
            detail="Repository not analyzed yet. Call GET /api/graph first.",
        )

    try:
        answer = await ask(
            question=req.message,
            file_summaries=cached["summaries"],
            file_contents=cached["contents"],
            file_context=req.file_context,
        )
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Missing env var: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"answer": answer}
