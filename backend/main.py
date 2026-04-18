import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db
from ai import call_ai, chat_with_board
from auth import HARDCODED_PASSWORD, HARDCODED_USERNAME, create_token, get_current_user
from models import AIResponse, BoardData


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    if req.username != HARDCODED_USERNAME or req.password != HARDCODED_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return {"token": create_token(req.username)}


@app.post("/api/auth/logout")
async def logout():
    return {"status": "ok"}


@app.get("/api/auth/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/ai/ping")
async def ai_ping():
    try:
        result = await call_ai(
            [{"role": "user", "content": "What is 2+2? Reply with just the number."}]
        )
        return {"response": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/chat", response_model=AIResponse)
async def chat(req: ChatRequest, username: str = Depends(get_current_user)):
    board = db.get_board(username)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    try:
        result = await chat_with_board(board, req.history, req.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    if result.board_update is not None:
        saved = db.save_board(username, result.board_update)
        result = AIResponse(message=result.message, board_update=saved)
    return result


@app.get("/api/board", response_model=BoardData)
def get_board(username: str = Depends(get_current_user)):
    board = db.get_board(username)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


@app.put("/api/board", response_model=BoardData)
def put_board(board: BoardData, username: str = Depends(get_current_user)):
    updated = db.save_board(username, board)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return updated


if os.path.isdir("static"):
    # Explicit HTML page routes must come before the StaticFiles mount.
    # Starlette's StaticFiles finds the Next.js data directory (e.g. static/login/)
    # before static/login.html, serving a 404. Explicit routes bypass this.
    from fastapi.responses import FileResponse

    @app.get("/login")
    async def login_page():
        return FileResponse("static/login.html")

    app.mount("/", StaticFiles(directory="static", html=True), name="static")
