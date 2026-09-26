import os
import google.generativeai as genai

_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.environ["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


def build_context(file_summaries: list[dict], relevant_paths: list[str], file_contents: dict[str, str]) -> str:
    chunks = []
    for path in relevant_paths[:6]:
        content = file_contents.get(path, "")
        if len(content) > 3000:
            content = content[:3000] + "\n... (truncated)"
        chunks.append(f"### {path}\n```\n{content}\n```")
    return "\n\n".join(chunks)


def find_relevant_files(query: str, file_summaries: list[dict], file_context: str | None) -> list[str]:
    query_lower = query.lower()
    scored: list[tuple[float, str]] = []

    for summary in file_summaries:
        path = summary["path"]
        score = 0.0

        if file_context and path == file_context:
            score += 10.0
        if any(word in path.lower() for word in query_lower.split()):
            score += 3.0
        for symbol in summary.get("symbols", []) + summary.get("exports", []):
            if symbol.lower() in query_lower:
                score += 2.0
        for imp in summary.get("imports", []):
            if any(word in imp.lower() for word in query_lower.split()):
                score += 1.0

        if score > 0:
            scored.append((score, path))

    scored.sort(reverse=True)
    return [path for _, path in scored[:6]]


async def enrich_nodes(file_summaries: list[dict], file_contents: dict[str, str]) -> list[dict]:
    """
    Ask Gemini to produce a short label + category for each file.
    Returns list of {path, label, category} dicts.
    Category is one of: entry, component, service, util, config, style, test, other
    """
    # Build a compact manifest for Gemini to read
    lines = []
    for s in file_summaries[:60]:  # cap to avoid token overflow
        path = s["path"]
        lang = s.get("language", "unknown")
        symbols = ", ".join(s.get("symbols", [])[:5]) or "—"
        snippet = file_contents.get(path, "")[:400].replace("\n", " ")
        lines.append(f'{path} [{lang}] symbols:{symbols} | {snippet}')
    manifest = "\n".join(lines)

    prompt = f"""You are a code analyst. For each file below, return a JSON array where each item has:
- "path": exact path as given
- "label": a SHORT (2-5 word) plain English description of what this file does (e.g. "User auth handler", "API route config", "Date utility helpers")
- "category": exactly one of: entry | component | service | router | util | config | style | test | other

Only return the JSON array, no markdown, no explanation.

Files:
{manifest}
"""
    model = _get_model()
    response = model.generate_content(prompt)
    text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    import json
    try:
        return json.loads(text)
    except Exception:
        # Fallback: return paths with no enrichment
        return [{"path": s["path"], "label": s["path"].split("/")[-1], "category": "other"} for s in file_summaries]


async def ask(
    question: str,
    file_summaries: list[dict],
    file_contents: dict[str, str],
    file_context: str | None = None,
) -> str:
    relevant = find_relevant_files(question, file_summaries, file_context)

    if not relevant:
        entry_candidates = ["src/index.ts", "src/index.tsx", "src/main.ts", "src/main.tsx", "index.js", "index.ts"]
        relevant = [p for p in entry_candidates if p in file_contents][:3]

    context = build_context(file_summaries, relevant, file_contents)

    prompt = f"""You are a codebase assistant. Answer questions about the repository using only the code provided below.
Always reference specific files and line numbers where relevant. Be concise and technical.

## Repository Context
{context}

## Question
{question}

## Answer
"""

    model = _get_model()
    response = model.generate_content(prompt)
    return response.text.strip()
