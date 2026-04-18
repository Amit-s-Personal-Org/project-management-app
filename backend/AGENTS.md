# Backend AGENTS.md

## Overview

A Python FastAPI backend. Managed with `uv`. Run inside Docker; the Dockerfile at the project root builds and serves it on port 8000.

## Stack

- **Framework:** FastAPI
- **Server:** Uvicorn
- **Package manager:** uv (`pyproject.toml`)
- **Python:** 3.12
- **Database:** SQLite via stdlib `sqlite3`
- **Auth:** PyJWT (HS256 tokens)

## File Structure

```
backend/
  main.py          — FastAPI app, all routes, lifespan startup
  auth.py          — JWT creation/verification, get_current_user dependency
  db.py            — DB connection, schema init, seed, get_board / save_board
  models.py        — Pydantic models: Card, Column, BoardData
  pyproject.toml   — uv-managed dependencies
  test_auth.py     — pytest tests for auth routes
  test_board.py    — pytest tests for board routes
```

## Running Locally (via Docker)

```bash
./scripts/start.sh   # build image and start container on port 8000
./scripts/stop.sh    # stop and remove the container
```

The SQLite database is stored at `/data/pm.db` inside the container. Mount a volume to persist it across restarts (the start script does this).

## Running Tests

```bash
# Inside the container:
docker run --rm pm-app python -m pytest test_auth.py test_board.py -v

# Or locally with uv (from backend/):
uv run pytest
```

## API Endpoints

| Method | Path               | Auth | Description                               |
|--------|--------------------|------|-------------------------------------------|
| POST   | /api/auth/login    | No   | Returns JWT for valid credentials         |
| POST   | /api/auth/logout   | No   | No-op (client drops token)                |
| GET    | /api/auth/me       | Yes  | Returns `{username}` for valid token      |
| GET    | /api/health        | No   | Health check                              |
| GET    | /api/board         | Yes  | Returns the user's full BoardData         |
| PUT    | /api/board         | Yes  | Replaces full board state, returns updated BoardData |

## Data Model

`BoardData` (matches the frontend TypeScript type exactly):
```json
{
  "columns": [{ "id": "1", "title": "Backlog", "cardIds": ["1", "2"] }],
  "cards":   { "1": { "id": "1", "title": "...", "details": "..." } }
}
```

Integer DB IDs are serialised as strings. The `PUT /api/board` strategy is delete-and-reinsert: all columns/cards for the board are deleted and re-inserted on every save, so returned IDs will differ from sent IDs. The frontend always replaces its state with the response.

## Adding Dependencies

Add to `dependencies` in `pyproject.toml`. The Dockerfile installs all deps via `uv pip install --system -r pyproject.toml`.
