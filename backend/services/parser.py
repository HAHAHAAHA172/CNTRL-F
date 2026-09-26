import re
from typing import Any

# ── Language definitions ───────────────────────────────────────────────────
# Each entry: extensions, import regex (group 1 = imported path/module)

LANGUAGES: list[dict[str, Any]] = [
    {
        "name": "javascript",
        "extensions": {".js", ".jsx", ".mjs", ".cjs"},
        "import_re": re.compile(
            r"""(?:import\s+(?:[\s\S]*?from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]""",
            re.MULTILINE,
        ),
        "relative_only": True,
        "resolve_extensions": [".js", ".jsx", "/index.js", "/index.jsx"],
    },
    {
        "name": "typescript",
        "extensions": {".ts", ".tsx"},
        "import_re": re.compile(
            r"""(?:import\s+(?:[\s\S]*?from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]""",
            re.MULTILINE,
        ),
        "relative_only": True,
        "resolve_extensions": [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"],
    },
    {
        "name": "python",
        "extensions": {".py"},
        "import_re": re.compile(
            r"^(?:from\s+([\w./]+)\s+import|import\s+([\w./]+))",
            re.MULTILINE,
        ),
        "relative_only": False,
        "resolve_extensions": [".py", "/__init__.py"],
    },
    {
        "name": "java",
        "extensions": {".java"},
        "import_re": re.compile(
            r"^import\s+(?:static\s+)?([\w.]+);",
            re.MULTILINE,
        ),
        "relative_only": False,
        "resolve_extensions": [".java"],
    },
    {
        "name": "go",
        "extensions": {".go"},
        "import_re": re.compile(
            r'"([\w./\-]+)"',
            re.MULTILINE,
        ),
        "relative_only": False,
        "resolve_extensions": [".go"],
    },
    {
        "name": "rust",
        "extensions": {".rs"},
        "import_re": re.compile(
            r"^use\s+([\w:]+)",
            re.MULTILINE,
        ),
        "relative_only": False,
        "resolve_extensions": [".rs", "/mod.rs"],
    },
    {
        "name": "c",
        "extensions": {".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"},
        "import_re": re.compile(
            r'#include\s+"([^"]+)"',
            re.MULTILINE,
        ),
        "relative_only": True,
        "resolve_extensions": [".h", ".hpp", ".c", ".cpp"],
    },
    {
        "name": "ruby",
        "extensions": {".rb"},
        "import_re": re.compile(
            r"""(?:require|require_relative)\s+['"]([^'"]+)['"]""",
            re.MULTILINE,
        ),
        "relative_only": False,
        "resolve_extensions": [".rb"],
    },
    {
        "name": "php",
        "extensions": {".php"},
        "import_re": re.compile(
            r"""(?:require|require_once|include|include_once)\s+['"]([^'"]+)['"]""",
            re.MULTILINE,
        ),
        "relative_only": True,
        "resolve_extensions": [".php"],
    },
]

ALL_EXTENSIONS: set[str] = set()
for _lang in LANGUAGES:
    ALL_EXTENSIONS.update(_lang["extensions"])

# Keep JS_TS_EXTENSIONS for backward compat with analyze.py
JS_TS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def _ext(path: str) -> str:
    dot = path.rfind(".")
    return path[dot:] if dot != -1 else ""


def _lang_for(path: str) -> dict[str, Any] | None:
    ext = _ext(path)
    for lang in LANGUAGES:
        if ext in lang["extensions"]:
            return lang
    return None


def _is_supported(path: str) -> bool:
    return _ext(path) in ALL_EXTENSIONS


def _resolve_relative(source_path: str, import_path: str, all_paths: set[str], exts: list[str]) -> str | None:
    parts = source_path.split("/")
    base = "/".join(parts[:-1])
    segments = (base + "/" + import_path).split("/")
    resolved: list[str] = []
    for seg in segments:
        if seg == "..":
            if resolved:
                resolved.pop()
        elif seg and seg != ".":
            resolved.append(seg)
    candidate = "/".join(resolved)

    # Try exact match first
    if candidate in all_paths:
        return candidate
    # Then try with extensions
    for suffix in exts:
        full = candidate + suffix
        if full in all_paths:
            return full
    return None


def _resolve_python(source_path: str, import_str: str, all_paths: set[str]) -> str | None:
    """Convert 'package.module' → 'package/module.py'."""
    candidate = import_str.replace(".", "/")
    for suffix in [".py", "/__init__.py"]:
        full = candidate + suffix
        if full in all_paths:
            return full
    # Also try relative to source dir
    base = "/".join(source_path.split("/")[:-1])
    for suffix in [".py", "/__init__.py"]:
        full = base + "/" + candidate + suffix
        if full in all_paths:
            return full
    return None


def _resolve_java(import_str: str, all_paths: set[str]) -> str | None:
    """Convert 'com.example.MyClass' → 'com/example/MyClass.java'."""
    candidate = import_str.replace(".", "/") + ".java"
    if candidate in all_paths:
        return candidate
    return None


def _get_imports(path: str, content: str, lang: dict[str, Any]) -> list[str]:
    imports = []
    for match in lang["import_re"].finditer(content):
        # Some regexes have two groups (python)
        val = match.group(1) or (match.lastindex and match.lastindex >= 2 and match.group(2))
        if val:
            imports.append(val.strip())
    return imports


def build_graph(
    file_tree: list[dict[str, Any]],
    file_contents: dict[str, str],
) -> dict[str, Any]:
    all_paths = {item["path"] for item in file_tree if _is_supported(item["path"])}

    nodes = []
    edges = []
    edge_set: set[tuple[str, str]] = set()

    for path in sorted(all_paths):
        lang = _lang_for(path)
        if not lang:
            continue
        label = path.removeprefix("src/")
        nodes.append({"id": path, "data": {"label": label}, "type": "default"})

        content = file_contents.get(path, "")
        if not content:
            continue

        for imp in _get_imports(path, content, lang):
            target = None

            if lang["name"] == "python":
                target = _resolve_python(path, imp, all_paths)
            elif lang["name"] == "java":
                target = _resolve_java(imp, all_paths)
            elif lang["relative_only"] and not (imp.startswith(".") or imp.startswith("/")):
                continue
            else:
                target = _resolve_relative(path, imp, all_paths, lang["resolve_extensions"])

            if target and target != path and (path, target) not in edge_set:
                edge_set.add((path, target))
                edges.append({
                    "id": f"{path}->{target}",
                    "source": path,
                    "target": target,
                })

    return {"nodes": nodes, "edges": edges}


def extract_file_summary(path: str, content: str) -> dict[str, Any]:
    lang = _lang_for(path)
    imports: list[str] = []

    if lang:
        imports = _get_imports(path, content, lang)

    # Generic symbol extraction (works for most C-family languages)
    exports = re.findall(r"export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)", content)
    functions = re.findall(r"(?:^|\s)(?:def|func|function|class|fn)\s+(\w+)", content, re.MULTILINE)

    return {
        "path": path,
        "language": lang["name"] if lang else "unknown",
        "imports": imports,
        "exports": exports,
        "symbols": list(set(functions)),
        "lines": content.count("\n") + 1,
    }
