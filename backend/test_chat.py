from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import db
from auth import create_token
from main import app
from models import AIResponse, BoardData, Card, Column


@pytest.fixture()
def client(tmp_path):
    db.DATABASE_PATH = str(tmp_path / "test.db")
    with TestClient(app) as c:
        yield c


def _auth(username: str = "user") -> dict:
    return {"Authorization": f"Bearer {create_token(username)}"}


def _minimal_board() -> BoardData:
    return BoardData(
        columns=[Column(id="col-1", title="Backlog", cardIds=["card-1"])],
        cards={"card-1": Card(id="card-1", title="Test card", details="")},
    )


def test_chat_requires_auth(client):
    res = client.post("/api/chat", json={"message": "Hello"})
    assert res.status_code == 401


def test_chat_message_only(client):
    ai_resp = AIResponse(message="Sure, how can I help?", board_update=None)
    with patch("main.chat_with_board", new=AsyncMock(return_value=ai_resp)):
        res = client.post("/api/chat", json={"message": "Hello"}, headers=_auth())
    assert res.status_code == 200
    data = res.json()
    assert data["message"] == "Sure, how can I help?"
    assert data["board_update"] is None


def test_chat_board_update_is_persisted(client):
    updated_board = _minimal_board()
    ai_resp = AIResponse(message="Done, I moved the card!", board_update=updated_board)
    with patch("main.chat_with_board", new=AsyncMock(return_value=ai_resp)):
        res = client.post("/api/chat", json={"message": "Move card to Backlog"}, headers=_auth())
    assert res.status_code == 200
    assert res.json()["board_update"] is not None

    # Board change must be visible via GET /api/board
    board_res = client.get("/api/board", headers=_auth())
    assert board_res.status_code == 200
    board = board_res.json()
    column_titles = [c["title"] for c in board["columns"]]
    assert "Backlog" in column_titles


def test_chat_malformed_json_returns_500(client):
    with patch(
        "main.chat_with_board",
        new=AsyncMock(side_effect=ValueError("AI returned invalid JSON: ...")),
    ):
        res = client.post("/api/chat", json={"message": "Hello"}, headers=_auth())
    assert res.status_code == 500
    assert "invalid JSON" in res.json()["detail"]


def test_chat_passes_history_and_message(client):
    captured: dict = {}

    async def mock_chat(board, history, message):
        captured["history"] = history
        captured["message"] = message
        return AIResponse(message="ok", board_update=None)

    with patch("main.chat_with_board", new=mock_chat):
        res = client.post(
            "/api/chat",
            json={
                "message": "What was the first thing I said?",
                "history": [
                    {"role": "user", "content": "Hello"},
                    {"role": "assistant", "content": "Hi there!"},
                ],
            },
            headers=_auth(),
        )
    assert res.status_code == 200
    assert captured["message"] == "What was the first thing I said?"
    assert len(captured["history"]) == 2
    assert captured["history"][0]["content"] == "Hello"
