from fastapi import APIRouter, HTTPException, Query
from services.ai import generate_onboarding
from routers.analyze import _cache

router = APIRouter()


@router.get("/api/onboarding")
async def get_onboarding(repo: str = Query(...)):
    cached = _cache.get(repo)
    if not cached:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet.")

    # Return cached onboarding if already generated
    if "onboarding" in cached:
        return {"steps": cached["onboarding"]}

    try:
        steps = await generate_onboarding(
            file_summaries=cached["summaries"],
            file_contents=cached["contents"],
            edges=cached.get("edges", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    cached["onboarding"] = steps
    return {"steps": steps}
