import hashlib
import os
import sqlite3
from datetime import datetime, timezone

from models import BoardData, Card, Column

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
    path = DATABASE_PATH
    if path != ":memory:":
        db_dir = os.path.dirname(path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
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
        _seed_user(conn)


def _seed_user(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT id FROM users WHERE username = 'user'").fetchone()
    if row:
        return

    # Placeholder hash — replaced with proper bcrypt when real auth is added
    password_hash = hashlib.sha256(b"password").hexdigest()
    cursor = conn.execute(
        "INSERT INTO users (username, password_hash) VALUES ('user', ?)",
        (password_hash,),
    )
    user_id = cursor.lastrowid

    cursor = conn.execute(
        "INSERT INTO boards (user_id, created_at) VALUES (?, ?)",
        (user_id, datetime.now(timezone.utc).isoformat()),
    )
    board_id = cursor.lastrowid

    for col_pos, col in enumerate(_SEED_COLUMNS):
        cursor = conn.execute(
            "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
            (board_id, col["title"], col_pos),
        )
        col_id = cursor.lastrowid
        for card_pos, card in enumerate(col["cards"]):
            conn.execute(
                "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
                (col_id, card["title"], card["details"], card_pos),
            )


def _board_id_for_user(conn: sqlite3.Connection, username: str) -> int | None:
    row = conn.execute(
        "SELECT b.id FROM boards b JOIN users u ON b.user_id = u.id WHERE u.username = ?",
        (username,),
    ).fetchone()
    return row["id"] if row else None


def _read_board(conn: sqlite3.Connection, board_id: int) -> BoardData:
    cols = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()

    columns: list[Column] = []
    cards: dict[str, Card] = {}

    for col in cols:
        col_cards = conn.execute(
            "SELECT id, title, details FROM cards WHERE column_id = ? ORDER BY position",
            (col["id"],),
        ).fetchall()
        card_ids = []
        for card in col_cards:
            cid = f"card-{card['id']}"
            card_ids.append(cid)
            cards[cid] = Card(id=cid, title=card["title"], details=card["details"])
        columns.append(Column(id=f"col-{col['id']}", title=col["title"], cardIds=card_ids))

    return BoardData(columns=columns, cards=cards)


def get_board(username: str) -> BoardData | None:
    with get_connection() as conn:
        board_id = _board_id_for_user(conn, username)
        if board_id is None:
            return None
        return _read_board(conn, board_id)


def save_board(username: str, board: BoardData) -> BoardData | None:
    with get_connection() as conn:
        board_id = _board_id_for_user(conn, username)
        if board_id is None:
            return None

        # Delete existing columns; cards cascade automatically
        conn.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))

        for col_pos, col in enumerate(board.columns):
            cursor = conn.execute(
                "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
                (board_id, col.title, col_pos),
            )
            new_col_id = cursor.lastrowid
            for card_pos, card_id in enumerate(col.cardIds):
                card = board.cards.get(card_id)
                if card is None:
                    continue
                conn.execute(
                    "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
                    (new_col_id, card.title, card.details, card_pos),
                )

        return _read_board(conn, board_id)
