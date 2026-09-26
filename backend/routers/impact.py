from fastapi import APIRouter, HTTPException, Query
from services.ai import ask
from routers.analyze import _cache

router = APIRouter()


def _build_reverse_map(edges: list[dict]) -> dict[str, list[str]]:
    """For each file, who imports it (reverse dependency map)."""
    rev: dict[str, list[str]] = {}
    for e in edges:
        rev.setdefault(e["target"], [])
        rev[e["target"]].append(e["source"])
    return rev


def _trace_impact(file_path: str, edges: list[dict], max_depth: int = 4) -> dict:
    """
    BFS from file_path following reverse edges (who depends on this file).
    Returns affected files grouped by distance.
    """
    rev = _build_reverse_map(edges)
    visited: set[str] = set()
    layers: list[list[str]] = []
    frontier = [file_path]
    visited.add(file_path)

    for _ in range(max_depth):
        next_frontier: list[str] = []
        for node in frontier:
            for dependant in rev.get(node, []):
                if dependant not in visited:
                    visited.add(dependant)
                    next_frontier.append(dependant)
        if not next_frontier:
            break
        layers.append(next_frontier)
        frontier = next_frontier

    return {
        "file": file_path,
        "affected": layers,
        "total_affected": sum(len(l) for l in layers),
    }


@router.get("/api/impact")
async def get_impact(
    repo: str = Query(...),
    file: str = Query(...),
):
    cached = _cache.get(repo)
    if not cached:
        raise HTTPException(status_code=400, detail="Repository not analyzed yet.")

    edges: list[dict] = cached.get("edges", [])
    impact = _trace_impact(file, edges)

    # Build flat affected list for AI context
    all_affected = [f for layer in impact["affected"] for f in layer]

    # Ask Gemini to explain the blast radius
    try:
        affected_list = "\n".join(f"- {f}" for f in all_affected[:20]) or "None found"
        question = (
            f"The file `{file}` was changed. "
            f"These files depend on it (directly or transitively):\n{affected_list}\n\n"
            f"In 3-5 bullet points: what could break, what should be tested, "
            f"and what is the risk level (low/medium/high)? Be specific to this codebase."
        )
        explanation = await ask(
            question=question,
            file_summaries=cached["summaries"],
            file_contents=cached["contents"],
            file_context=file,
        )
    except Exception as e:
        explanation = f"AI explanation unavailable: {e}"

    return {
        **impact,
        "explanation": explanation,
    }
