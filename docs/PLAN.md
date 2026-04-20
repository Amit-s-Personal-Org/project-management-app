# Project Plan

## Status

- [x] Part 1: Plan
- [x] Part 2: Scaffolding
- [x] Part 3: Add in Frontend
- [x] Part 4: Fake user sign-in
- [x] Part 5: Database modeling
- [x] Part 6: Backend API
- [x] Part 7: Frontend + Backend integration
- [x] Part 8: AI connectivity
- [x] Part 9: AI + Kanban structured outputs
- [x] Part 10: AI sidebar UI
- [x] Part 11: Multi-user signup/login
- [x] Part 12: Multiple project boards

---

## Part 1: Plan

Enrich the plan, create `frontend/AGENTS.md`, get user sign-off.

### Steps
- [x] Read and understand all existing frontend code
- [x] Write `frontend/AGENTS.md` describing the existing frontend
- [x] Enrich this document with substeps, tests, and success criteria for all parts
- [x] User reviews and approves the plan

### Success Criteria
- `frontend/AGENTS.md` accurately describes the existing code
- This document is detailed enough for an agent to execute each part without ambiguity
- User has approved the plan

---

## Part 2: Scaffolding

Set up Docker infrastructure, a minimal FastAPI backend, and start/stop scripts. Prove the stack works end-to-end with a hello-world example.

### Steps
- [x] Create `backend/main.py` with a FastAPI app that:
  - Serves a static `<h1>Hello World</h1>` at `GET /`
  - Returns `{"status": "ok"}` at `GET /api/health`
- [x] Create `backend/pyproject.toml` (uv-managed) with `fastapi` and `uvicorn` dependencies
- [x] Create `Dockerfile` at project root:
  - Single-stage image based on a Python slim base
  - Install uv, install Python deps via uv
  - Copy backend source
  - Expose port 8000, run uvicorn
- [x] Create `scripts/start.sh` (Mac/Linux) — builds and runs the Docker container
- [x] Create `scripts/stop.sh` (Mac/Linux) — stops and removes the container
- [x] Create `scripts/start.bat` (Windows) — equivalent
- [x] Create `scripts/stop.bat` (Windows) — equivalent
- [x] Update `backend/AGENTS.md` to describe the backend structure

### Tests
- `docker build` completes without error
- `GET /` returns 200 with HTML containing "Hello World"
- `GET /api/health` returns `{"status": "ok"}`
- `scripts/start.sh` brings up the container; `scripts/stop.sh` tears it down

### Success Criteria
- Running `./scripts/start.sh` brings up the app on `http://localhost:8000`
- Both endpoints above respond correctly in the running container
- `./scripts/stop.sh` cleanly removes the container

---

## Part 3: Add in Frontend

Build the Next.js frontend statically and serve it from FastAPI. The full Kanban UI is accessible at `/`.

### Steps
- [ ] Add `output: "export"` to `frontend/next.config.ts` so `next build` produces a static `out/` directory
- [ ] Update `Dockerfile` to:
  - Add a Node.js build stage that runs `npm ci && npm run build` in `frontend/`
  - Copy the resulting `out/` directory into the Python image
  - Configure FastAPI (`StaticFiles` mount + catch-all route) to serve the static files
- [ ] Verify that deep-linking and refresh still work (Next.js static export produces `.html` files per route)
- [ ] Write or update backend unit test confirming the root route returns HTML

### Tests
- `GET /` returns 200 with HTML containing "Kanban Studio"
- All five columns are visible in the browser
- Drag-and-drop, add card, rename column all work in the served build
- Existing frontend unit tests (`npm run test:unit`) still pass
- Existing Playwright e2e tests (`npm run test:e2e`) pass against the Docker-served app

### Success Criteria
- `http://localhost:8000/` shows the Kanban board with no console errors
- No frontend-only dev server is needed; everything is served from the container

---

## Part 4: Fake User Sign-In

Gate the Kanban board behind a login page. Hardcoded credentials: `user` / `password`.

### Steps
- [ ] Add `POST /api/auth/login` — accepts `{username, password}`, returns a signed JWT on success or 401 on failure
- [ ] Add `POST /api/auth/logout` — clears the token (stateless: client just drops the JWT)
- [ ] Add `GET /api/auth/me` — returns `{username}` if the JWT is valid, else 401
- [ ] Use `python-jose` (or `PyJWT`) for JWT signing; secret key from environment variable `SECRET_KEY` (default fallback for dev)
- [ ] In the frontend:
  - Add `src/app/login/page.tsx` — a login form (username + password inputs, submit button)
  - Add `src/lib/auth.ts` — API helpers: `login()`, `logout()`, `getMe()`
  - In `src/app/page.tsx`, call `getMe()` on mount; redirect to `/login` if not authenticated
  - Add a "Log out" button to the `KanbanBoard` header that calls `logout()` then redirects to `/login`
  - Store the JWT in `localStorage` (simple; acceptable for MVP)
- [ ] Update Dockerfile/start scripts if new env vars are needed

### Tests
- `POST /api/auth/login` with correct credentials returns a JWT
- `POST /api/auth/login` with wrong credentials returns 401
- `GET /api/auth/me` with valid JWT returns `{username: "user"}`
- `GET /api/auth/me` with no/invalid JWT returns 401
- Visiting `/` without a token redirects to `/login`
- Logging in with `user` / `password` lands on the Kanban board
- Logging out redirects back to `/login` and revisiting `/` redirects again

### Success Criteria
- The Kanban board is inaccessible without logging in
- Login/logout cycle works correctly in the browser

---

## Part 5: Database Modeling

Design and document the SQLite schema. No implementation yet — get sign-off first.

### Steps
- [ ] Design a schema covering: users, boards, columns, cards
- [ ] Write `docs/DATABASE.md` with:
  - Table definitions (column names, types, constraints)
  - Relationship diagram (text-based ERD is fine)
  - Rationale for any non-obvious decisions
  - Notes on how `initialData` from the frontend maps to seed data
- [ ] Present the schema to the user for review and approval

### Tests
- N/A (planning step only)

### Success Criteria
- User has reviewed and approved `docs/DATABASE.md`
- Schema supports multiple users (future), one board per user (MVP), ordered columns and cards

---

## Part 6: Backend API

Implement all CRUD routes for Kanban data. Database is created automatically if it does not exist.

### Steps
- [ ] Add `aiosqlite` (or `sqlite3` sync) and `sqlalchemy` (or raw SQL) to backend deps
- [ ] Add `backend/db.py` — database connection setup, table creation on startup
- [ ] Add `backend/models.py` — Pydantic models for request/response bodies
- [ ] Implement routes (all require valid JWT):
  - `GET /api/board` — returns the current user's board (columns + cards)
  - `PUT /api/board` — replaces the full board state for the current user
- [ ] On first login for a user, seed their board with `initialData` column/card structure
- [ ] Write pytest unit tests for all routes (use an in-memory SQLite test DB)
- [ ] Update `backend/AGENTS.md`

### Tests
- `GET /api/board` returns the seeded board on first call
- `PUT /api/board` with updated data persists and is returned by the next `GET`
- All routes return 401 when called without a valid JWT
- Tests pass with `pytest` inside the container (or locally with `uv run pytest`)

### Success Criteria
- Board state persists across container restarts (SQLite file on a Docker volume)
- All pytest tests pass

---

## Part 7: Frontend + Backend Integration

Wire the frontend to the real backend API. State now persists.

### Steps
- [ ] Add `src/lib/api.ts` — typed API client: `getBoard()`, `saveBoard(board: BoardData)`
- [ ] Update `KanbanBoard.tsx`:
  - On mount, call `getBoard()` and use the result as initial state (replacing `initialData`)
  - After every state change (drag, add, rename, delete), call `saveBoard()` with the new board state
  - Show a loading state while fetching on mount
- [ ] Remove the hardcoded `initialData` import from `KanbanBoard.tsx` (it now lives only in the backend seed logic)
- [ ] Update frontend unit tests to mock `api.ts`
- [ ] Update Playwright e2e tests to handle the login flow before testing the board

### Tests
- Board state survives a page refresh
- Board state survives a container restart
- Adding a card, then refreshing the page, still shows the card
- Dragging a card, then refreshing, preserves the new position
- Unit tests pass with mocked API
- E2E tests pass including login flow

### Success Criteria
- The app is a fully persistent Kanban board
- No in-memory-only state for board data

---

## Part 8: AI Connectivity

Add OpenRouter integration to the backend. Validate with a simple test call.

### Steps
- [ ] Add `httpx` (or `openai` SDK) to backend deps for making OpenRouter API calls
- [ ] Add `backend/ai.py` — an async function `call_ai(messages: list) -> str` that:
  - Calls OpenRouter using the `openai/gpt-oss-120b:free` model
  - Reads `OPENROUTER_API_KEY` from the environment
- [ ] Add `GET /api/ai/ping` — internal test route; sends `[{"role":"user","content":"What is 2+2?"}]` to the AI and returns the raw response (remove or protect this route before any production use)
- [ ] Add `OPENROUTER_API_KEY` to the Dockerfile / start scripts as a passed-through env var (it is already in `.env`)

### Tests
- `GET /api/ai/ping` returns a response containing "4" (or equivalent)
- If `OPENROUTER_API_KEY` is missing, the route returns a clear 500 error

### Success Criteria
- AI ping route returns a correct answer in the running container

---

## Part 9: AI + Kanban Structured Outputs

The AI receives the full board context and optionally updates the board.

### Steps
- [x] Define the AI response schema (Pydantic model):
  ```python
  class AIResponse(BaseModel):
      message: str
      board_update: BoardData | None = None
  ```
- [x] Update `backend/ai.py` to:
  - Accept the current board JSON and conversation history as context
  - Use a system prompt that explains the board structure and instructs the AI to respond with valid JSON matching `AIResponse`
  - Parse and validate the AI response against `AIResponse`
- [x] Add `POST /api/chat`:
  - Request body: `{ message: str, history: list[{role, content}] }`
  - Auth required
  - Returns `AIResponse`
  - If `board_update` is non-null, also persists the updated board to the DB
- [x] Write pytest tests using a mocked AI call:
  - AI returns a message only → board unchanged
  - AI returns a board update → board is updated in the DB
  - AI returns malformed JSON → returns a 500 with a clear error

### Tests
- All pytest tests for `/api/chat` pass with mocked AI
- A real call asking "Move card X to Done" results in the board being updated

### Success Criteria
- `/api/chat` correctly returns AI message and optionally updates the board
- The board state after an AI update is immediately reflected in `GET /api/board`

---

## Part 10: AI Sidebar UI

Add a polished sidebar for AI chat. Board refreshes automatically when the AI makes changes.

### Steps
- [x] Add `src/components/AISidebar.tsx`:
  - A slide-in panel fixed to the right side of the viewport
  - Chat input at the bottom, message history scrolling above
  - Sends `POST /api/chat` with the user's message and conversation history
  - Displays the AI's `message` in the chat history
  - If `board_update` is present in the response, calls a `onBoardUpdate(board)` callback
- [x] Update `KanbanBoard.tsx`:
  - Add a toggle button in the header to open/close the sidebar
  - Pass a `onBoardUpdate` handler to `AISidebar` that replaces board state and persists via `saveBoard()`
- [x] Style the sidebar using the existing CSS custom properties and design language
- [x] Add a visual indicator (e.g., a brief flash on the affected column) when the AI updates the board
- [x] Update frontend unit tests for `AISidebar`
- [x] Update Playwright e2e tests: log in, open sidebar, send a message, verify a response appears

### Tests
- Sending a message shows the AI reply in the chat history
- Asking the AI to add or move a card results in the board updating without a manual refresh
- The sidebar opens and closes correctly
- Unit tests pass for `AISidebar`
- E2E tests pass

### Success Criteria
- A user can have a natural conversation in the sidebar and the AI can manipulate the board
- All changes persist (AI updates go through `saveBoard()`)
- No console errors in normal use

---

## Part 11: Multi-User Signup/Login

Replace the hardcoded single-user auth with a real user registration and login system.

### Steps
- [x] Add `POST /api/auth/signup` — accepts `{username, password}`, hashes password with bcrypt, inserts into `users`, returns JWT
- [x] Update `POST /api/auth/login` — authenticate against the `users` table (remove hardcoded credentials)
- [x] Add `passlib[bcrypt]` to backend deps (already used for hashing, ensure it's declared)
- [x] In the frontend:
  - Update `src/app/login/page.tsx` — add toggle between Login and Sign Up modes
  - Add `signup()` to `src/lib/auth.ts`
  - Add `signup` API call to `src/lib/api.ts`
- [x] On signup, seed a default board for the new user (same seed data as Part 6)

### Tests
- `POST /api/auth/signup` creates a new user and returns a JWT
- `POST /api/auth/signup` with an existing username returns 409
- `POST /api/auth/login` works with DB-stored credentials, not hardcoded ones
- Signing up and immediately using the board works end-to-end

### Success Criteria
- Any user can create an account and log in
- Hardcoded `user`/`password` credentials are removed
- Each user sees only their own board

---

## Part 12: Multiple Project Boards

Allow each user to create, name, switch between, and delete multiple boards.

### Steps
- [x] Add `name` column (TEXT NOT NULL DEFAULT 'My Board') to `boards` table; migrate existing rows
- [x] Backend endpoints (all auth-required):
  - `GET /api/boards` — list all boards for the current user (`[{id, name, created_at}]`)
  - `POST /api/boards` — create a new named board, seed with default columns/cards, return board info
  - `DELETE /api/boards/{board_id}` — delete a board (must belong to current user)
  - Update `GET /api/board` → `GET /api/boards/{board_id}` — fetch a specific board's data
  - Update `PUT /api/board` → `PUT /api/boards/{board_id}` — save a specific board's data
- [x] Update `POST /api/chat` to accept `board_id` and operate on the correct board
- [x] Frontend:
  - Add `BoardSelector` component — header dropdown listing boards with create/delete actions
  - Update `src/lib/api.ts` with new typed API calls
  - Update `src/app/page.tsx` to track `activeBoardId` in state, pass to all API calls
  - On first load, fetch board list; default to first board (or prompt to create one)
- [x] Update Pydantic models in `backend/models.py`: add `BoardInfo`, update request/response shapes

### Tests
- User can create two boards, switch between them, and each retains independent state
- Deleting a board removes it and its columns/cards (cascade)
- `GET /api/boards/{board_id}` returns 403 if the board belongs to another user
- Board list shows correct names

### Success Criteria
- A user can manage multiple named project boards from the UI
- Board data is fully isolated per board and per user
- All existing AI chat functionality works with the active board
