import os
import httpx
from typing import Any

GITHUB_API = "https://api.github.com"

def _headers() -> dict[str, str]:
    token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def parse_repo_url(url: str) -> tuple[str, str]:
    """Extract owner and repo name from a GitHub URL."""
    url = url.rstrip("/").removesuffix(".git")
    parts = url.replace("https://github.com/", "").replace("http://github.com/", "").split("/")
    if len(parts) < 2:
        raise ValueError(f"Invalid GitHub URL: {url}")
    return parts[0], parts[1]


async def get_default_branch(owner: str, repo: str) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_headers(), timeout=15)
        r.raise_for_status()
        return r.json().get("default_branch", "main")


async def get_file_tree(owner: str, repo: str, branch: str) -> list[dict[str, Any]]:
    """Return all blob paths in the repo (flat list)."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=_headers(), timeout=30)
        r.raise_for_status()
        data = r.json()
        return [item for item in data.get("tree", []) if item.get("type") == "blob"]


async def get_file_content(owner: str, repo: str, path: str) -> str:
    """Fetch raw text content of a single file."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=_headers(), timeout=15)
        if r.status_code == 404:
            return ""
        r.raise_for_status()
        data = r.json()
        # GitHub returns base64-encoded content
        import base64
        content = data.get("content", "")
        return base64.b64decode(content).decode("utf-8", errors="replace")
