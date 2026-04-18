# Database Design

## Engine

SQLite, stored at `/data/pm.db` inside the container. The directory is mounted as a Docker volume so data persists across container restarts. The database file and all tables are created automatically on first startup if they do not exist.

## Schema

### `users`

| Column          | Type    | Constraints                  |
|-----------------|---------|------------------------------|
| `id`            | INTEGER | PRIMARY KEY AUTOINCREMENT    |
| `username`      | TEXT    | NOT NULL, UNIQUE             |
| `password_hash` | TEXT    | NOT NULL                     |

For the MVP the only user is hardcoded (`user` / `password`). `password_hash` stores a bcrypt hash; the row is inserted on first startup if it does not exist.

---

### `boards`

| Column       | Type    | Constraints                          |
|--------------|---------|--------------------------------------|
| `id`         | INTEGER | PRIMARY KEY AUTOINCREMENT            |
| `user_id`    | INTEGER | NOT NULL, REFERENCES users(id)       |
| `created_at` | TEXT    | NOT NULL (ISO 8601 UTC timestamp)    |

One board per user for the MVP. The extra table exists so multi-board support is a single migration away.

---

### `columns`

| Column     | Type    | Constraints                         |
|------------|---------|-------------------------------------|
| `id`       | INTEGER | PRIMARY KEY AUTOINCREMENT           |
| `board_id` | INTEGER | NOT NULL, REFERENCES boards(id)     |
| `title`    | TEXT    | NOT NULL                            |
| `position` | INTEGER | NOT NULL                            |

`position` is a zero-based integer. Column order is defined by ascending `position`. The frontend is the authoritative source of order; every `PUT /api/board` rewrites positions from the array index.

---

### `cards`

| Column      | Type    | Constraints                          |
|-------------|---------|--------------------------------------|
| `id`        | INTEGER | PRIMARY KEY AUTOINCREMENT            |
| `column_id` | INTEGER | NOT NULL, REFERENCES columns(id)     |
| `title`     | TEXT    | NOT NULL                             |
| `details`   | TEXT    | NOT NULL DEFAULT ''                  |
| `position`  | INTEGER | NOT NULL                             |

Cards belong to exactly one column. `position` is zero-based within each column. Same write strategy as columns.

---

## Entity-Relationship Diagram

```
users
  id ──────────────────────────┐
  username                     │
  password_hash                │
                               │ 1:many
boards                         │
  id ──────────────┐           │
  user_id ─────────┘◄──────────┘
  created_at       │
                   │ 1:many
columns            │
  id ───────┐      │
  board_id ─┘◄─────┘
  title
  position  │
            │ 1:many
cards       │
  id        │
  column_id ┘◄─────
  title
  details
  position
```

---

## API Mapping

The backend exposes two board endpoints (auth required):

| Method | Path        | Description                                      |
|--------|-------------|--------------------------------------------------|
| GET    | /api/board  | Returns the user's board as `BoardData` JSON     |
| PUT    | /api/board  | Replaces the full board state, returns `BoardData` |

`BoardData` (matching the frontend type exactly):

```json
{
  "columns": [
    { "id": "1", "title": "Backlog", "cardIds": ["1", "2"] }
  ],
  "cards": {
    "1": { "id": "1", "title": "Align roadmap themes", "details": "..." },
    "2": { "id": "2", "title": "Gather customer signals", "details": "..." }
  }
}
```

Database integer IDs are serialised as strings to match the frontend's `id: string` type. The frontend treats IDs as opaque strings, so this is transparent.

`PUT /api/board` strategy: delete all existing columns and cards for the board, then re-insert from the request body. Simple and correct given the frontend always sends the full board state.

---

## Seed Data

On first startup, if the user has no board, one is created and seeded with the five columns and eight cards from the frontend's `initialData`:

| Column      | Cards                                      |
|-------------|--------------------------------------------|
| Backlog     | Align roadmap themes, Gather customer signals |
| Discovery   | Prototype analytics view                   |
| In Progress | Refine status language, Design card layout |
| Review      | QA micro-interactions                      |
| Done        | Ship marketing page, Close onboarding sprint |
