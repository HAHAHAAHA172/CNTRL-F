import os
import google.generativeai as genai

_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.environ["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-3.8-flash")
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


async def generate_onboarding(
    file_summaries: list[dict],
    file_contents: dict[str, str],
    edges: list[dict],
) -> list[dict]:
    """
    Generate a guided onboarding path through the repository.
    Returns a list of steps, each with: title, description, files, tip.
    """
    import json

    # Build a compact manifest: file paths, languages, symbols, and edge summary
    file_lines = []
    for s in file_summaries[:60]:
        path = s["path"]
        lang = s.get("language", "unknown")
        symbols = ", ".join(s.get("symbols", [])[:5]) or "—"
        imports = ", ".join(s.get("imports", [])[:5]) or "—"
        file_lines.append(f"{path} [{lang}] symbols:{symbols} imports:{imports}")
    manifest = "\n".join(file_lines)

    # Summarize dependency edges
    edge_lines = []
    for e in edges[:80]:
        edge_lines.append(f"{e['source']} → {e['target']}")
    edge_summary = "\n".join(edge_lines) if edge_lines else "No dependency edges found."

    prompt = f"""You are an expert developer onboarding guide. Given the following repository manifest (files, symbols, imports) and dependency graph, generate a learning path for a new developer.

Return a JSON array of 5-7 steps. Each step has:
- "title": short step title (e.g. "Project Structure Overview")
- "description": 2-3 sentence explanation of what to learn in this step and why it matters
- "files": array of 1-4 exact file paths from the manifest that are most relevant to this step
- "tip": one practical tip for understanding this part of the codebase

The steps should follow a logical learning order:
1. Project structure & configuration
2. Application entry point(s)
3. Core business logic / main features
4. Data layer / API routes
5. Utilities & shared code
6. Tests (if any)
7. Suggested first contribution area

Only include steps that are relevant based on the actual files present. Use exact file paths from the manifest.
Only return the JSON array, no markdown, no explanation.

## Files
{manifest}

## Dependencies
{edge_summary}
"""
    model = _get_model()
    response = model.generate_content(prompt)
    text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        steps = json.loads(text)
        # Validate structure
        if isinstance(steps, list) and len(steps) > 0:
            return steps
    except Exception:
        pass

    # Fallback: generate a basic onboarding from static analysis
    all_paths = [s["path"] for s in file_summaries]
    entry_keywords = ["index", "main", "app", "server"]
    entries = [p for p in all_paths if any(k in p.lower() for k in entry_keywords)][:3]
    return [
        {
            "title": "Project Structure",
            "description": f"This repository contains {len(all_paths)} analyzed files. Start by browsing the top-level directory structure.",
            "files": all_paths[:3],
            "tip": "Look at the folder names to understand how the project is organized.",
        },
        {
            "title": "Entry Points",
            "description": "These files are likely where the application starts.",
            "files": entries or all_paths[:2],
            "tip": "Trace the imports from the entry point to understand the dependency tree.",
        },
    ]


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
