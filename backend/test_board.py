import pytest
from fastapi.testclient import TestClient

import db
from main import app


@pytest.fixture()
def client(tmp_path):
    db.DATABASE_PATH = str(tmp_path / "test.db")
    with TestClient(app) as c:
        yield c


def _auth_headers(client: TestClient) -> dict:
    res = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_get_board_returns_seeded_data(client):
    res = client.get("/api/board", headers=_auth_headers(client))
    assert res.status_code == 200
    data = res.json()
    assert len(data["columns"]) == 5
    assert len(data["cards"]) == 8


def test_get_board_column_order(client):
    res = client.get("/api/board", headers=_auth_headers(client))
    titles = [c["title"] for c in res.json()["columns"]]
    assert titles == ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def test_get_board_requires_auth(client):
    res = client.get("/api/board")
    assert res.status_code == 401


def test_put_board_requires_auth(client):
    res = client.put("/api/board", json={"columns": [], "cards": {}})
    assert res.status_code == 401


def test_put_board_returns_board_data(client):
    headers = _auth_headers(client)
    board = client.get("/api/board", headers=headers).json()
    res = client.put("/api/board", json=board, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "columns" in data
    assert "cards" in data


def test_put_board_persists_rename(client):
    headers = _auth_headers(client)
    board = client.get("/api/board", headers=headers).json()
    board["columns"][0]["title"] = "Now Playing"
    client.put("/api/board", json=board, headers=headers)

    refreshed = client.get("/api/board", headers=headers).json()
    assert refreshed["columns"][0]["title"] == "Now Playing"


def test_put_board_persists_new_card(client):
    headers = _auth_headers(client)
    board = client.get("/api/board", headers=headers).json()
    original_count = len(board["cards"])

    new_card_id = "tmp-new"
    board["cards"][new_card_id] = {"id": new_card_id, "title": "New task", "details": "Details here"}
    board["columns"][0]["cardIds"].append(new_card_id)
    client.put("/api/board", json=board, headers=headers)

    refreshed = client.get("/api/board", headers=headers).json()
    assert len(refreshed["cards"]) == original_count + 1
    titles = [c["title"] for c in refreshed["cards"].values()]
    assert "New task" in titles


def test_put_board_persists_card_move(client):
    headers = _auth_headers(client)
    board = client.get("/api/board", headers=headers).json()

    # Move all cards from column 0 to column 1
    moved_ids = board["columns"][0]["cardIds"][:]
    board["columns"][1]["cardIds"] = moved_ids + board["columns"][1]["cardIds"]
    board["columns"][0]["cardIds"] = []
    client.put("/api/board", json=board, headers=headers)

    refreshed = client.get("/api/board", headers=headers).json()
    assert refreshed["columns"][0]["cardIds"] == []
    assert len(refreshed["columns"][1]["cardIds"]) == len(moved_ids) + len(board["columns"][1]["cardIds"]) - len(moved_ids)


def test_put_board_persists_card_deletion(client):
    headers = _auth_headers(client)
    board = client.get("/api/board", headers=headers).json()
    original_count = len(board["cards"])

    # Remove first card from column 0
    removed_id = board["columns"][0]["cardIds"].pop(0)
    del board["cards"][removed_id]
    client.put("/api/board", json=board, headers=headers)

    refreshed = client.get("/api/board", headers=headers).json()
    assert len(refreshed["cards"]) == original_count - 1
