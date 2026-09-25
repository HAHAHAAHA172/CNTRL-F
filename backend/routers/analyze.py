from fastapi import APIRouter, HTTPException, Query
from services.github import parse_repo_url, get_default_branch, get_file_tree, get_file_content
from services.parser import build_graph, extract_file_summary, JS_TS_EXTENSIONS

router = APIRouter()

# Simple in-process cache: repo_url → {nodes, edges, summaries, contents}
_cache: dict[str, dict] = {}


def _is_js_ts(path: str) -> bool:
    return any(path.endswith(ext) for ext in JS_TS_EXTENSIONS)


@router.get("/api/graph")
async def get_graph(repo: str = Query(..., description="GitHub repository URL")):
    if repo in _cache:
        cached = _cache[repo]
        return {"nodes": cached["nodes"], "edges": cached["edges"], "cached": True}

    try:
        owner, name = parse_repo_url(repo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        branch = await get_default_branch(owner, name)
        tree = await get_file_tree(owner, name, branch)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")

    # Fetch only JS/TS files (cap at 80 to stay within rate limits)
    js_files = [item for item in tree if _is_js_ts(item["path"])][:80]

    file_contents: dict[str, str] = {}
    for item in js_files:
        try:
            content = await get_file_content(owner, name, item["path"])
            file_contents[item["path"]] = content
        except Exception:
            file_contents[item["path"]] = ""

    graph = build_graph(tree, file_contents)

    # Build summaries for AI context
    summaries = [extract_file_summary(p, c) for p, c in file_contents.items()]

    _cache[repo] = {
        **graph,
        "summaries": summaries,
        "contents": file_contents,
    }

    return {"nodes": graph["nodes"], "edges": graph["edges"], "cached": False}


@router.get("/api/graph/cache")
async def list_cached():
    return {"repos": list(_cache.keys())}
