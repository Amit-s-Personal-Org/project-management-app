[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# PM — Kanban Board with AI Sidebar

A full-stack project management app featuring a drag-and-drop Kanban board and an AI chat sidebar that can create, move, and rename cards on your behalf. Supports multiple boards per user, dark/light mode, and a mobile-optimised layout.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │     KanbanBoard          │   │       AISidebar           │  │
│  │  (@dnd-kit drag & drop)  │   │  (chat + board_update)    │  │
│  │                          │   │                           │  │
│  │  columns[] + cards{}     │◄──┤  replaces board state     │  │
│  └────────────┬─────────────┘   └──────────────┬────────────┘  │
│               │                                │               │
│               └──────────┬─────────────────────┘               │
│                          │  fetch + Authorization: Bearer JWT   │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │   FastAPI       │  :8000
                  │   (main.py)     │
                  │                 │
                  │  /api/auth/*    │
                  │  /api/boards/*  │
                  │  /api/chat      │
                  │  /api/health    │
                  └───┬─────────┬───┘
                      │         │
           ┌──────────▼──┐  ┌───▼──────────────┐
           │  SQLite DB  │  │  OpenRouter API   │
           │  (db.py)    │  │  (ai.py)          │
           │             │  │                   │
           │  users      │  │  model: claude /  │
           │  boards     │  │  gpt / etc.       │
           │  columns    │  │                   │
           │  cards      │  │  returns message  │
           └─────────────┘  │  + board_update   │
                            └──────────────────┘
```

### Request Flow

1. The Next.js frontend (`lib/api.ts`) makes `fetch` calls to `/api/*` with `Authorization: Bearer <token>`
2. FastAPI validates the JWT via `get_current_user()`, then routes to the appropriate handler
3. Board and card operations go through `db.py` which enforces per-user ownership via `_assert_board_ownership()`
4. AI chat (`POST /api/chat`) sends the full board JSON + message history to OpenRouter; the response may contain a `board_update` that replaces board state on the frontend
5. In production, FastAPI also serves the compiled Next.js static export from `./static/`

### Auth Flow

```
POST /api/auth/signup  ──► create user (bcrypt hash) ──► return JWT
POST /api/auth/login   ──► verify password            ──► return JWT
GET  /api/auth/me      ──► validate JWT               ──► return username

JWT: HS256, 24h expiry, stored in localStorage as `pm_token`
```

### Database Schema

```
users
  id, username (unique), password_hash, created_at

boards
  id, user_id (FK → users), title, created_at

columns
  id, board_id (FK → boards), title, position

cards
  id, column_id (FK → columns), title, details, position
```

All relationships use `ON DELETE CASCADE`. Board ownership is enforced server-side on every operation.

### AI Board Updates

When the AI returns a `board_update` object, the frontend replaces the entire board state:

```
POST /api/chat
  body: { board_id, messages: [...], board: { columns, cards } }

response: {
  message: "I've moved the card to Done",
  board_update: { columns: [...], cards: {...} } | null
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4 |
| Icons | lucide-react |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Auth | PyJWT (HS256), bcrypt |
| Database | SQLite (via Python stdlib `sqlite3`) |
| AI | OpenRouter API (model-agnostic) |
| Package mgmt | npm (frontend), uv (backend) |
| Container | Docker (multi-stage build) |

---

## Running the App

### Option 1 — Docker (recommended, full stack on port 8000)

**Prerequisites:** Docker

```bash
# 1. Create a .env file in the project root
cp .env.example .env        # or create manually:
echo "OPENROUTER_API_KEY=sk-or-..." > .env
echo "SECRET_KEY=your-random-secret" >> .env

# 2. Build and start
./scripts/start.sh

# 3. Open http://localhost:8000

# Stop
./scripts/stop.sh
```

The Docker build is multi-stage:
- Stage 1: `node:22-slim` builds the Next.js static export
- Stage 2: `python:3.12-slim` installs the backend and copies the static files into `./static/`
- SQLite data is persisted in a Docker volume (`pm-data`)

---

### Option 2 — Local Development (frontend + backend separately)

**Prerequisites:** Node.js 22+, Python 3.12+, `uv`

#### Backend

```bash
cd backend

# Install dependencies
uv pip install --system -r pyproject.toml

# Set environment variables
export OPENROUTER_API_KEY=sk-or-...
export SECRET_KEY=your-random-secret
export DATABASE_URL=./dev.db   # optional, defaults to /data/pm.db

# Start the API server
uvicorn main:app --reload --port 8001
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (proxies /api/* to localhost:8001 if configured)
npm run dev
# Opens at http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes (for AI) | — | API key from openrouter.ai |
| `SECRET_KEY` | Yes | — | Random string for JWT signing |
| `DATABASE_URL` | No | `/data/pm.db` | SQLite file path (use `:memory:` for tests) |

---

## Running Tests

### Backend

```bash
cd backend
python -m pytest                              # all tests
python -m pytest test_board.py               # single file
python -m pytest test_board.py::test_fn_name # single test
python -m pytest -v                          # verbose
```

### Frontend — Unit Tests (Vitest)

```bash
cd frontend
npm run test:unit          # run once
npm run test:unit:watch    # watch mode
npx vitest src/components/SomeComponent.test.tsx  # single file
```

### Frontend — E2E Tests (Playwright)

```bash
# Requires the Docker app running on port 8000
./scripts/start.sh

cd frontend
npm run test:e2e
npx playwright test tests/kanban.spec.ts   # single spec
```

---

## Project Structure

```
pm/
├── Dockerfile              # Multi-stage Docker build
├── scripts/
│   ├── start.sh            # Build and run Docker container
│   └── stop.sh             # Stop container
├── .env                    # Environment variables (not committed)
│
├── backend/
│   ├── main.py             # FastAPI app, all route handlers
│   ├── db.py               # SQLite access layer, schema init, seeding
│   ├── auth.py             # JWT creation/validation, bcrypt hashing
│   ├── models.py           # Pydantic request/response models
│   ├── ai.py               # OpenRouter API client
│   ├── pyproject.toml      # Python dependencies (uv)
│   ├── test_board.py       # Board CRUD tests
│   ├── test_auth.py        # Auth tests
│   ├── test_chat.py        # AI chat tests
│   └── conftest.py         # Pytest fixtures
│
└── frontend/
    ├── next.config.ts      # output: "export" for static build
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx       # Root layout + anti-flash theme script
    │   │   ├── page.tsx         # Auth gate; redirects to /login if unauthed
    │   │   ├── globals.css      # CSS variables (light + dark themes)
    │   │   └── login/
    │   │       └── page.tsx     # Login / sign-up form
    │   ├── components/
    │   │   ├── KanbanBoard.tsx       # Board state, DnD, header
    │   │   ├── KanbanColumn.tsx      # Droppable column
    │   │   ├── KanbanCard.tsx        # Sortable card with hover-delete icon
    │   │   ├── KanbanCardPreview.tsx # Drag overlay ghost
    │   │   ├── NewCardForm.tsx       # Inline add-card form
    │   │   ├── AISidebar.tsx         # Fixed right-side chat panel
    │   │   ├── BoardSelector.tsx     # Header dropdown (switch/create/delete)
    │   │   └── ThemeToggle.tsx       # Dark/light mode button
    │   └── lib/
    │       ├── api.ts      # Typed fetch wrapper for all API calls
    │       ├── auth.ts     # Token read/write helpers (localStorage)
    │       └── kanban.ts   # Data types, moveCard(), createId()
    └── tests/
        └── (Playwright E2E specs)
```

---

## License

MIT © 2026 Amit Upadhyay
