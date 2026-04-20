# Code Review Resolution

Based on the review in `code_review.md` (reviewed by Gemini CLI, 2026-04-20).

---

## Implemented

### 1. ID Stability via `ext_id` columns
**Original finding:** Full State PUT resets auto-increment IDs on every save, breaking AI sync.

Added `ext_id TEXT` columns to `columns` and `cards` tables. The backend now stores and returns the client-generated string IDs (e.g. `card-a1b2c3d4`) through the full round-trip instead of discarding them on re-insert. Existing rows are backfilled with `col-{int}` / `card-{int}` on migration. Seed inserts use `uuid4`-based IDs.

Files: `backend/db.py`

---

### 2. AI ID Management
**Original finding:** AI was told to increment from the highest existing card number, but IDs shifted every save.

Updated the system prompt to instruct the AI to preserve existing IDs exactly and generate `card-xxxxxxxx` / `col-xxxxxxxx` format for new items. This is now consistent with the stable IDs returned by the backend.

Files: `backend/ai.py`

---

### 3. SECRET_KEY Hard Fail
**Original finding:** Hardcoded default `SECRET_KEY` in `auth.py` means a misconfigured production deploy silently uses a known-public key.

`auth.py` now raises `RuntimeError` at startup if `SECRET_KEY` is not set. A proper random key has been added to `.env`. A `conftest.py` injects a test-only key via `pytest_configure` so the test suite continues to work without environment setup.

Files: `backend/auth.py`, `.env`, `backend/conftest.py`

---

### 4. Pydantic Model Validator on `BoardData`
**Original finding:** No validation that `cardIds` in columns actually exist in the `cards` dict.

Added a `@model_validator(mode="after")` on `BoardData` that raises `ValueError` listing the missing IDs if any column references a card not present in the `cards` dict. This catches malformed AI responses and bad client payloads before they reach the database.

Files: `backend/models.py`

---

## Not Implemented

### Incremental Update Endpoints (PATCH/move-card)
**Finding:** Full State PUT causes unnecessary DB churn and doesn't scale.

**Why ignored:** For a personal Kanban with small boards the performance impact is negligible. The ID stability fix (above) addresses the actual bug caused by the wipe-reinsert pattern. Introducing `PATCH /api/cards/{id}` and `POST /api/boards/{id}/move-card` would require significant changes across the frontend, backend, and tests with no practical benefit at this scale. Revisit if board sizes grow or the app becomes multi-tenant.

---

### Concurrency Control (optimistic locking)
**Finding:** Simultaneous user + AI updates cause last-write-wins data loss.

**Why ignored:** The race window between a human drag-and-drop and an in-flight AI response is narrow in a single-user app. The added complexity of a `version` column and 409 conflict handling in the frontend is not justified for this use case. Revisit if real-time collaboration is added.

---

### JWT Storage — move to `httpOnly` cookies
**Finding:** `localStorage` JWT is vulnerable to XSS.

**Why ignored:** The frontend is a Next.js static export (`output: "export"`). There is no server-side rendering layer to set `httpOnly` cookies on login — doing so would require a backend proxy endpoint and rewriting the auth flow. This is a valid long-term improvement but is an architectural change, not a quick fix. The current XSS risk is low given the app has no user-generated HTML rendering.

---

### Brittle JSON Parsing in `ai.py`
**Finding:** Regex-based JSON extraction will fail if the LLM deviates from the expected format.

**Why ignored:** The existing extraction already handles two cases: markdown code fences and bare JSON (first `{` to last `}`). Switching to structured outputs requires a model that supports `response_format: { type: "json_object" }` — the current model (`openrouter/free`) does not guarantee this. The finding is valid but not actionable without a model change.

---

### "God Component" — `KanbanBoard.tsx` refactor
**Finding:** `KanbanBoard.tsx` mixes state, DnD logic, API calls, and rendering.

**Why ignored:** The component works correctly and is not causing bugs. Extracting `useBoardState` / `useBoardActions` hooks is a code quality improvement but carries refactor risk with no functional gain. Deferred to a dedicated frontend cleanup task.

---

### Missing AI Integration Tests
**Finding:** No backend tests covering the `/api/chat` endpoint's interaction with the DB.

**Why ignored:** `test_chat.py` already covers auth, board persistence via AI update, malformed JSON handling, history passing, and wrong board ID — the meaningful integration paths. What the original finding described as "missing" (mocking OpenRouter to test `chat_with_board` logic) is already present. No action needed.
