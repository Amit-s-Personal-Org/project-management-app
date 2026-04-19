import pytest
from fastapi.testclient import TestClient

import db
from main import app


@pytest.fixture()
def client(tmp_path):
    db.DATABASE_PATH = str(tmp_path / "test.db")
    with TestClient(app) as c:
        yield c


def _signup(client: TestClient, username: str = "user", password: str = "password") -> tuple[dict, int]:
    """Sign up, return (auth_headers, first_board_id)."""
    res = client.post("/api/auth/signup", json={"username": username, "password": password})
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    boards = client.get("/api/boards", headers=headers).json()
    return headers, boards[0]["id"]


# ---------------------------------------------------------------------------
# Board list
# ---------------------------------------------------------------------------

def test_list_boards_returns_seeded_board(client):
    headers, _ = _signup(client)
    res = client.get("/api/boards", headers=headers)
    assert res.status_code == 200
    boards = res.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"


def test_list_boards_requires_auth(client):
    res = client.get("/api/boards")
    assert res.status_code == 401


def test_create_board(client):
    headers, _ = _signup(client)
    res = client.post("/api/boards", json={"name": "Sprint 42"}, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Sprint 42"


def test_create_board_has_default_columns_no_cards(client):
    headers, _ = _signup(client)
    res = client.post("/api/boards", json={"name": "New"}, headers=headers)
    board_id = res.json()["id"]
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert [c["title"] for c in board["columns"]] == ["Backlog", "Discovery", "In Progress", "Review", "Done"]
    assert board["cards"] == {}


def test_delete_board(client):
    headers, _ = _signup(client)
    res = client.post("/api/boards", json={"name": "Temp"}, headers=headers)
    board_id = res.json()["id"]
    del_res = client.delete(f"/api/boards/{board_id}", headers=headers)
    assert del_res.status_code == 204
    boards = client.get("/api/boards", headers=headers).json()
    assert all(b["id"] != board_id for b in boards)


def test_delete_board_from_other_user_returns_404(client):
    headers_a, _ = _signup(client, "alice", "pw1")
    headers_b, board_id_b = _signup(client, "bob", "pw2")
    res = client.delete(f"/api/boards/{board_id_b}", headers=headers_a)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Board CRUD
# ---------------------------------------------------------------------------

def test_get_board_returns_seeded_data(client):
    headers, board_id = _signup(client)
    res = client.get(f"/api/boards/{board_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["columns"]) == 5
    assert len(data["cards"]) == 8


def test_get_board_column_order(client):
    headers, board_id = _signup(client)
    res = client.get(f"/api/boards/{board_id}", headers=headers)
    titles = [c["title"] for c in res.json()["columns"]]
    assert titles == ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def test_get_board_requires_auth(client):
    res = client.get("/api/boards/1")
    assert res.status_code == 401


def test_put_board_requires_auth(client):
    res = client.put("/api/boards/1", json={"columns": [], "cards": {}})
    assert res.status_code == 401


def test_put_board_returns_board_data(client):
    headers, board_id = _signup(client)
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    res = client.put(f"/api/boards/{board_id}", json=board, headers=headers)
    assert res.status_code == 200
    assert "columns" in res.json()
    assert "cards" in res.json()


def test_put_board_persists_rename(client):
    headers, board_id = _signup(client)
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    board["columns"][0]["title"] = "Now Playing"
    client.put(f"/api/boards/{board_id}", json=board, headers=headers)
    refreshed = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert refreshed["columns"][0]["title"] == "Now Playing"


def test_put_board_persists_new_card(client):
    headers, board_id = _signup(client)
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    original_count = len(board["cards"])
    board["cards"]["tmp-new"] = {"id": "tmp-new", "title": "New task", "details": "Details"}
    board["columns"][0]["cardIds"].append("tmp-new")
    client.put(f"/api/boards/{board_id}", json=board, headers=headers)
    refreshed = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert len(refreshed["cards"]) == original_count + 1
    assert "New task" in [c["title"] for c in refreshed["cards"].values()]


def test_put_board_persists_card_deletion(client):
    headers, board_id = _signup(client)
    board = client.get(f"/api/boards/{board_id}", headers=headers).json()
    original_count = len(board["cards"])
    removed_id = board["columns"][0]["cardIds"].pop(0)
    del board["cards"][removed_id]
    client.put(f"/api/boards/{board_id}", json=board, headers=headers)
    refreshed = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert len(refreshed["cards"]) == original_count - 1


def test_boards_are_isolated_between_users(client):
    headers_a, board_id_a = _signup(client, "alice", "pw1")
    headers_b, board_id_b = _signup(client, "bob", "pw2")
    # alice cannot read bob's board
    res = client.get(f"/api/boards/{board_id_b}", headers=headers_a)
    assert res.status_code == 404
