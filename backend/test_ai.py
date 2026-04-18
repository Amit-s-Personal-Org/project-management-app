from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import db
from main import app


@pytest.fixture()
def client(tmp_path):
    db.DATABASE_PATH = str(tmp_path / "test.db")
    with TestClient(app) as c:
        yield c


def test_ai_ping_returns_response(client):
    with patch("main.call_ai", new=AsyncMock(return_value="4")):
        res = client.get("/api/ai/ping")
    assert res.status_code == 200
    assert res.json()["response"] == "4"


def test_ai_ping_missing_key_returns_500(client):
    with patch("main.call_ai", new=AsyncMock(side_effect=ValueError("OPENROUTER_API_KEY is not set"))):
        res = client.get("/api/ai/ping")
    assert res.status_code == 500
    assert "OPENROUTER_API_KEY" in res.json()["detail"]
