---
name: cntrl-f-feature
description: Use when adding a new feature to CNTRL F — covers frontend React component, FastAPI backend route, service logic, and wiring frontend to backend.
---

# CNTRL F — Development Skill

## Project
CNTRL F is a solo-built IBM Bob 2.0 hackathon project.

Tagline: "Find your way through any codebase."

Goal: AI-powered web app helping developers understand unfamiliar public GitHub repositories through:
1. Interactive codebase graph
2. Codebase-aware AI assistant
3. Impact Explorer
4. Guided Onboarding

Core flow: GitHub URL → fetch repo → analyze code → build dependency graph → visualize → retrieve relevant code → AI explanation.

## MVP PRIORITY
Implement in this order:
1. GitHub URL input
2. Repository fetching
3. JS/TS file/import analysis
4. Dependency graph
5. React Flow visualization
6. File/node inspection
7. Codebase-aware AI Q&A
8. Impact Explorer
9. Guided Onboarding
10. UI polish, error handling, demo, documentation

Do NOT expand scope unless explicitly requested.

## TECH STACK

Frontend:
- React + TypeScript + Vite
- Tailwind CSS
- @xyflow/react
- lucide-react
- Native fetch()

Backend:
- Python + FastAPI
- Static code analysis
- GitHub API / repository fetching

MVP scope: public repos only, JS/TS focus, no auth, no DB, no collaboration, no extensions.

## ARCHITECTURE

```
cntrl-f/
├── frontend/frontend/src/    ← React/Vite app
├── backend/routers/          ← FastAPI route handlers
├── backend/services/         ← GitHub fetcher, parser, AI
└── README.md
```

Vite proxies `/api/*` → `http://localhost:8000`. Never hardcode backend URLs in frontend.

Backend pipeline: GitHub → Fetcher → Parser → Repository Index → Graph / AI

Repository index shape:
- files, functions, classes, imports, dependencies, summaries

**Static analysis determines relationships. AI explains relationships. Never ask AI to invent the dependency graph.**

## GRAPH

Use `@xyflow/react`. Avoid rendering every symbol at once.

Default view: architecture/modules → important files → drill down on click.

Support: zoom, pan, node selection, relationship visualization, connected-node highlighting.

Possible modes: Architecture, Dependencies, Impact, Data Flow.

## AI

The assistant MUST be repository-aware. Pipeline before every answer:
1. Identify relevant files/functions from the repository index.
2. Retrieve only that code as context.
3. Ask the model to answer using that context.
4. Reference files/lines in the response.

Example questions the AI must handle:
- Where is authentication handled?
- Where is this function used?
- Where should I add Google login?
- How does data reach the database?
- Why does this file depend on that one?

Do not build a generic chatbot.

## IMPACT EXPLORER

When a file/function is selected:
1. Traverse actual dependency relationships (static analysis).
2. Identify affected components.
3. Show the dependency path.
4. Ask AI to explain potential impact and tests to review.

## GUIDED ONBOARDING

Generate a short learning path:
1. Project structure → 2. Entry point → 3. Authentication → 4. API → 5. Database → 6. Suggested first contribution.

Each step references relevant graph nodes/files.

## DEVELOPMENT RULES

- Simplest implementation that works.
- Optimize for 48-hour solo hackathon.
- Do not over-engineer.
- Reuse existing dependencies; avoid adding libraries unless necessary.
- Keep components modular but small.
- Use TypeScript types instead of `any`.
- Handle errors explicitly.
- Never expose API keys in frontend. Keep secrets in `.env`.
- Do not rewrite working code unnecessarily.

## CONTEXT & TOKEN OPTIMIZATION

### Noise Reduction
Only include information relevant to the current task.

Do NOT:
- Restate the entire project architecture for every request.
- Repeat unchanged code.
- Include unrelated files.
- Explain obvious implementation details unless requested.
- Reproduce large logs when only the error matters.
- Re-read or summarize files that are not relevant to the current change.

When inspecting a codebase:
1. Identify the relevant component/module.
2. Read only directly related files.
3. Expand context only when necessary.
4. Prefer targeted searches over broad repository scans.

### Context Reuse
Treat the following as stable project context:
- CNTRL F architecture
- MVP scope
- technology stack
- coding conventions
- repository structure
- established API contracts
- established component interfaces

Do not regenerate or restate stable context unless it has changed.

Reuse previously established decisions instead of reconsidering them.

### Incremental Changes
Prefer small, targeted modifications.

When a file already works:
- modify only the required section
- preserve unrelated code
- avoid rewriting entire files

When debugging:
- start with the reported error
- inspect the smallest relevant code path
- expand investigation only if required

### Output Compression
Keep responses concise.

Before coding:
1. Identify the smallest change required.
2. Check existing implementation.
3. Implement.
4. Run/test if possible.

For completed changes report:
- Changed: files/features
- Result: test/build status
- Next: one action

Do not provide long explanations unless requested.

## UI PRINCIPLES

Developer tool aesthetic: clean, dark, technical, minimal.

Landing page:
```
CNTRL F
"Find your way through any codebase."
[ GitHub repository URL       ]
[ Analyze Repository          ]
  Try Demo Repository
```

Dashboard: graph is the primary workspace. Details beside it. AI accessible without covering the graph.

## HACKATHON STRATEGY

Prioritize a working end-to-end demo over feature count.

Critical milestone: GitHub URL → repository analysis → interactive graph.

If time is limited, cut in this order: Polish → Onboarding → Impact Explorer → AI Q&A → Graph (never cut the core).

## RESPONSE FORMAT

For implementation requests always respond with:

**PLAN**
- 1–3 short bullets

**CHANGES**
- files to modify

**IMPLEMENTATION**
- code / commands

**VERIFY**
- how to test

**NEXT**
- one recommended next step

Do not provide long explanations unless asked.
