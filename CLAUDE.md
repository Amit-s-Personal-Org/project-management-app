# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack project management app with a Kanban board and AI chat sidebar. Frontend is Next.js (static export), backend is FastAPI serving both the API and the static files, SQLite for storage.

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Static export to /out
npm run lint         # ESLint
npm run test:unit    # Vitest unit tests (run once)
npm run test:unit:watch  # Vitest watch mode
npx vitest src/components/SomeComponent.test.tsx  # Single test file
npm run test:e2e     # Playwright E2E (requires Docker app running)
npx playwright test tests/kanban.spec.ts  # Single E2E test
```

### Backend (`cd backend`)
```bash
python -m pytest                              # All tests
python -m pytest test_board.py               # Single file
python -m pytest test_board.py::test_fn_name # Single test
python -m pytest -v                          # Verbose
```

### Docker (full stack on port 8000)
```bash
./scripts/start.sh   # Build and start container
./scripts/stop.sh    # Stop container
```

## Architecture

### Request Flow
- Frontend (`lib/api.ts`) makes fetch calls with `Authorization: Bearer <token>` to `/api/*`
- Backend FastAPI (`backend/main.py`) handles all routes; static Next.js export is served from `/frontend/out/` in production
- Auth: JWT (HS256, 24h expiry) stored in `localStorage` as `pm_token`; validated via FastAPI `get_current_user()` dependency

### Backend Structure
- `main.py` — all route handlers
- `db.py` — SQLite access; `_assert_board_ownership()` enforces that users only access their own boards
- `auth.py` — JWT creation/validation, bcrypt hashing; reads `SECRET_KEY` env var
- `models.py` — Pydantic request/response models
- `ai.py` — OpenRouter API client; reads `OPENROUTER_API_KEY` env var

### Frontend Structure
- `src/app/` — Next.js pages: `layout.tsx`, login page, main board page
- `src/components/` — `KanbanBoard`, `AISidebar`, `BoardSelector`, and card/column subcomponents
- `src/lib/api.ts` — typed fetch wrapper for all API calls
- `src/lib/auth.ts` — token read/write helpers

### Database
SQLite at `/data/pm.db` (Docker volume). Schema: `users → boards → columns → cards` with cascade deletes and position ordering on columns/cards.

### AI Chat
POST `/api/chat` sends current board JSON + message history to OpenRouter. The AI returns `{ message, board_update }`. If `board_update` is non-null, the frontend replaces the board state entirely — this is how AI creates/moves/renames cards.

### Kanban Board State
Board data in the frontend uses `@dnd-kit` for drag-and-drop:
```typescript
{ columns: [{ id, title, cardIds }], cards: { [cardId]: { id, title, details } } }
```

### Multi-user
Users can only see their own boards. On first signup, a seeded board ("My Board") is created with 5 columns and 8 sample cards.

## Configuration
- `frontend/next.config.ts`: `output: "export"` — required for Docker static serving; do not remove
- `frontend/vitest.config.ts`: jsdom environment with React plugin
- `frontend/playwright.config.ts`: tests against `http://127.0.0.1:8000` (Docker)
- `backend/pyproject.toml`: managed with `uv`; run `uv add <pkg>` to add dependencies
- `.env` (root): `OPENROUTER_API_KEY` for AI features; `DATABASE_URL` defaults to `/data/pm.db`
