# Project Overview: PM (Kanban Studio)

A full-stack project management application featuring a persistent Kanban board and an AI chat sidebar. The AI can directly manipulate the board state (creating, moving, or renaming cards and columns) based on user instructions.

## Tech Stack

- **Backend:** FastAPI (Python 3.12+), SQLite (via `sqlite3`), Pydantic for models, JWT for authentication, `uv` for dependency management.
- **Frontend:** Next.js 15 (React 19), `@dnd-kit` for drag-and-drop, Vanilla CSS, `vitest` for unit testing, `playwright` for E2E testing.
- **Infrastructure:** Docker (multi-stage build), serving static frontend files via FastAPI.
- **AI Integration:** OpenRouter API (GPT models) for structured board updates and chat.

---

## Getting Started

### Prerequisites
- Docker (for full-stack deployment)
- Python 3.12 & `uv` (for local backend development)
- Node.js 22 & `npm` (for local frontend development)
- `OPENROUTER_API_KEY` in a `.env` file (root)

### Building and Running

**Using Docker (Recommended):**
- **Start:** `./scripts/start.sh` (Mac/Linux) or `scripts\start.bat` (Windows). This builds the frontend, then the backend, and starts the container on `http://localhost:8000`.
- **Stop:** `./scripts/stop.sh` or `scripts\stop.bat`.

**Local Development:**
- **Frontend:** `cd frontend && npm install && npm run dev` (Runs on `http://localhost:3000`).
- **Backend:** `cd backend && uv sync && uvicorn main:app --reload` (Runs on `http://localhost:8000`).

---

## Development Commands

### Frontend (`frontend/`)
- `npm run dev`: Start Next.js development server.
- `npm run build`: Generate a static export in `out/`.
- `npm run lint`: Run ESLint.
- `npm run test:unit`: Run Vitest unit tests.
- `npm run test:e2e`: Run Playwright E2E tests (requires the app to be running).

### Backend (`backend/`)
- `python -m pytest`: Run all backend tests.
- `uv add <package>`: Add a new Python dependency.
- `uvicorn main:app --reload`: Start the FastAPI server with hot reload.

---

## Project Structure

```text
/
├── backend/            # FastAPI source, models, and tests
├── frontend/           # Next.js source, components, and tests
│   ├── src/app/        # App router (login, main page)
│   ├── src/components/ # Kanban and AI Sidebar components
│   └── src/lib/        # API and Auth utilities
├── docs/               # Architecture, Plan, and Database docs
├── scripts/            # Docker lifecycle scripts
└── Dockerfile          # Multi-stage production build
```

---

## Development Conventions

- **Auth:** JWT-based. Tokens are stored in `localStorage` as `pm_token`.
- **State Management:** The frontend uses React state with `@dnd-kit`. Every board modification is persisted to the backend via `PUT /api/boards/{id}`.
- **AI Updates:** The AI returns a JSON structure containing a `message` and an optional `board_update`. If present, the frontend replaces the entire board state with the update.
- **Database:** SQLite is used for persistence. The database file is located at `/data/pm.db` inside the Docker container.
- **Testing:** 
    - Frontend unit tests use Vitest and React Testing Library.
    - Frontend E2E tests use Playwright.
    - Backend tests use `pytest` with a mocked AI and in-memory SQLite for isolation.
