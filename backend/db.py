import os
import sqlite3
import uuid
from datetime import datetime, timezone

from models import BoardData, BoardInfo, Card, Column

DATABASE_PATH = os.getenv("DATABASE_URL", "/data/pm.db")

_SEED_COLUMNS = [
    {
        "title": "Backlog",
        "cards": [
            {"title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics."},
            {"title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback."},
        ],
    },
    {
        "title": "Discovery",
        "cards": [
            {"title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs."},
        ],
    },
    {
        "title": "In Progress",
        "cards": [
            {"title": "Refine status language", "details": "Standardize column labels and tone across the board."},
            {"title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists."},
        ],
    },
    {
        "title": "Review",
        "cards": [
            {"title": "QA micro-interactions", "details": "Verify hover, focus, and loading states."},
        ],
    },
    {
        "title": "Done",
        "cards": [
            {"title": "Ship marketing page", "details": "Final copy approved and asset pack delivered."},
            {"title": "Close onboarding sprint", "details": "Document release notes and share internally."},
        ],
    },
]


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    if DATABASE_PATH != ":memory:":
        db_dir = os.path.dirname(DATABASE_PATH)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL
            );
            CREATE TABLE IF NOT EXISTS boards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT    NOT NULL DEFAULT 'My Board',
                created_at TEXT    NOT NULL
            );
            CREATE TABLE IF NOT EXISTS columns (
                id       INTEGER PRIMARY KEY,
                board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                title    TEXT    NOT NULL,
                position INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cards (
                id        INTEGER PRIMARY KEY,
                column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
                title     TEXT    NOT NULL,
                details   TEXT    NOT NULL DEFAULT '',
                position  INTEGER NOT NULL
            );
        """)
        try:
            conn.execute("ALTER TABLE boards ADD COLUMN name TEXT NOT NULL DEFAULT 'My Board'")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE columns ADD COLUMN ext_id TEXT")
            conn.execute("UPDATE columns SET ext_id = 'col-' || id WHERE ext_id IS NULL")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE cards ADD COLUMN ext_id TEXT")
            conn.execute("UPDATE cards SET ext_id = 'card-' || id WHERE ext_id IS NULL")
        except sqlite3.OperationalError:
            pass


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def get_user_by_username(username: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return dict(row) if row else None


def create_user(username: str, password_hash: str) -> int:
    """Insert a new user and seed a default board. Returns user_id."""
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' is already taken")
        _insert_board(conn, user_id, "My Board", seed=True)
        return user_id


# ---------------------------------------------------------------------------
# Board helpers
# ---------------------------------------------------------------------------

def _insert_board(conn: sqlite3.Connection, user_id: int, name: str, seed: bool = False) -> int:
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name, created_at) VALUES (?, ?, ?)",
        (user_id, name, datetime.now(timezone.utc).isoformat()),
    )
    board_id = cursor.lastrowid
    for col_pos, col in enumerate(_SEED_COLUMNS):
        col_ext_id = f"col-{uuid.uuid4().hex[:12]}"
        cursor = conn.execute(
            "INSERT INTO columns (board_id, title, position, ext_id) VALUES (?, ?, ?, ?)",
            (board_id, col["title"], col_pos, col_ext_id),
        )
        col_id = cursor.lastrowid
        if seed:
            for card_pos, card in enumerate(col["cards"]):
                card_ext_id = f"card-{uuid.uuid4().hex[:12]}"
                conn.execute(
                    "INSERT INTO cards (column_id, title, details, position, ext_id) VALUES (?, ?, ?, ?, ?)",
                    (col_id, card["title"], card["details"], card_pos, card_ext_id),
                )
    return board_id


def get_boards_for_user(username: str) -> list[BoardInfo]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT b.id, b.name, b.created_at
               FROM boards b JOIN users u ON b.user_id = u.id
               WHERE u.username = ?
               ORDER BY b.created_at""",
            (username,),
        ).fetchall()
        return [BoardInfo(id=r["id"], name=r["name"], created_at=r["created_at"]) for r in rows]


def create_board_for_user(username: str, name: str) -> BoardInfo:
    with get_connection() as conn:
        user_row = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if not user_row:
            raise ValueError("User not found")
        board_id = _insert_board(conn, user_row["id"], name, seed=False)
        row = conn.execute(
            "SELECT id, name, created_at FROM boards WHERE id = ?", (board_id,)
        ).fetchone()
        return BoardInfo(id=row["id"], name=row["name"], created_at=row["created_at"])


def delete_board(board_id: int, username: str) -> bool:
    """Delete board if it belongs to the user. Returns True on success."""
    with get_connection() as conn:
        if not _assert_board_ownership(conn, board_id, username):
            return False
        conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
        return True


def _read_board(conn: sqlite3.Connection, board_id: int) -> BoardData:
    cols = conn.execute(
        "SELECT id, ext_id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    card_ids_by_col: dict[int, list[str]] = {col["id"]: [] for col in cols}
    cards: dict[str, Card] = {}

    for card in conn.execute(
        """SELECT c.id, c.ext_id, c.title, c.details, c.column_id
           FROM cards c
           JOIN columns col ON c.column_id = col.id
           WHERE col.board_id = ?
           ORDER BY col.position, c.position""",
        (board_id,),
    ).fetchall():
        cid = card["ext_id"] or f"card-{card['id']}"
        cards[cid] = Card(id=cid, title=card["title"], details=card["details"])
        card_ids_by_col[card["column_id"]].append(cid)

    columns = [
        Column(
            id=col["ext_id"] or f"col-{col['id']}",
            title=col["title"],
            cardIds=card_ids_by_col[col["id"]],
        )
        for col in cols
    ]
    return BoardData(columns=columns, cards=cards)


def _assert_board_ownership(conn: sqlite3.Connection, board_id: int, username: str) -> bool:
    row = conn.execute(
        """SELECT b.id FROM boards b JOIN users u ON b.user_id = u.id
           WHERE b.id = ? AND u.username = ?""",
        (board_id, username),
    ).fetchone()
    return row is not None


def get_board_by_id(board_id: int, username: str) -> BoardData | None:
    with get_connection() as conn:
        if not _assert_board_ownership(conn, board_id, username):
            return None
        return _read_board(conn, board_id)


def save_board_by_id(board_id: int, username: str, board: BoardData) -> BoardData | None:
    with get_connection() as conn:
        if not _assert_board_ownership(conn, board_id, username):
            return None

        conn.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))

        for col_pos, col in enumerate(board.columns):
            cursor = conn.execute(
                "INSERT INTO columns (board_id, title, position, ext_id) VALUES (?, ?, ?, ?)",
                (board_id, col.title, col_pos, col.id),
            )
            new_col_id = cursor.lastrowid
            for card_pos, card_id in enumerate(col.cardIds):
                card = board.cards.get(card_id)
                if card is None:
                    continue
                conn.execute(
                    "INSERT INTO cards (column_id, title, details, position, ext_id) VALUES (?, ?, ?, ?, ?)",
                    (new_col_id, card.title, card.details, card_pos, card_id),
                )

        return _read_board(conn, board_id)
