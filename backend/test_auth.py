import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _get_token() -> str:
    res = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    return res.json()["token"]


def test_login_success():
    res = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    assert res.status_code == 200
    assert "token" in res.json()


def test_login_wrong_password():
    res = client.post(
        "/api/auth/login", json={"username": "user", "password": "wrong"}
    )
    assert res.status_code == 401


def test_login_wrong_username():
    res = client.post(
        "/api/auth/login", json={"username": "admin", "password": "password"}
    )
    assert res.status_code == 401


def test_me_with_valid_token():
    token = _get_token()
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"username": "user"}


def test_me_without_token():
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_with_invalid_token():
    res = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert res.status_code == 401


def test_logout():
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
