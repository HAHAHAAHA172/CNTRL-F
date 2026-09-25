import re
from typing import Any

# Match: import ... from '...' | import('...') | require('...')
_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\s\S]*?from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]""",
    re.MULTILINE,
)

JS_TS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def _is_js_ts(path: str) -> bool:
    return any(path.endswith(ext) for ext in JS_TS_EXTENSIONS)


def _resolve_import(source_path: str, import_path: str, all_paths: set[str]) -> str | None:
    """Try to resolve a relative import to an actual file path in the repo."""
    if not import_path.startswith("."):
        return None  # external package

    # Build base directory of source file
    parts = source_path.split("/")
    base = "/".join(parts[:-1])

    # Normalize the import path
    segments = (base + "/" + import_path).split("/")
    resolved: list[str] = []
    for seg in segments:
        if seg == "..":
            if resolved:
                resolved.pop()
        elif seg and seg != ".":
            resolved.append(seg)
    candidate = "/".join(resolved)

    # Try with and without extensions
    for ext in ["", ".ts", ".tsx", ".js", ".jsx"]:
        for suffix in [ext, "/index" + ext]:
            full = candidate + suffix
            if full in all_paths:
                return full

    return None


def build_graph(
    file_tree: list[dict[str, Any]],
    file_contents: dict[str, str],
) -> dict[str, Any]:
    """
    Returns { nodes: [...], edges: [...] } for the React Flow graph.
    Only includes JS/TS files.
    """
    js_paths = {item["path"] for item in file_tree if _is_js_ts(item["path"])}

    nodes = []
    edges = []
    edge_set: set[tuple[str, str]] = set()

    for path in sorted(js_paths):
        # Shorten label — drop src/ prefix if present
        label = path.removeprefix("src/")
        nodes.append({"id": path, "data": {"label": label}, "type": "default"})

        content = file_contents.get(path, "")
        for match in _IMPORT_RE.finditer(content):
            import_path = match.group(1)
            target = _resolve_import(path, import_path, js_paths)
            if target and (path, target) not in edge_set:
                edge_set.add((path, target))
                edges.append({
                    "id": f"{path}->{target}",
                    "source": path,
                    "target": target,
                })

    return {"nodes": nodes, "edges": edges}


def extract_file_summary(path: str, content: str) -> dict[str, Any]:
    """Extract imports, exports, and top-level symbols from a single file."""
    imports: list[str] = []
    for match in _IMPORT_RE.finditer(content):
        imports.append(match.group(1))

    # Rough export detection
    exports = re.findall(r"export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)", content)

    # Top-level function/class names
    functions = re.findall(r"(?:function|class)\s+(\w+)", content)

    return {
        "path": path,
        "imports": imports,
        "exports": exports,
        "symbols": list(set(functions)),
        "lines": content.count("\n") + 1,
    }
