import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles

import db
from ai import call_ai, chat_with_board
from auth import create_token, get_current_user, hash_password, verify_password
from models import AIResponse, AuthRequest, BoardData, BoardInfo, ChatRequest, CreateBoardRequest


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@app.post("/api/auth/signup")
async def signup(req: AuthRequest):
    if not req.username.strip() or not req.password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username and password required")
    try:
        db.create_user(req.username.strip(), hash_password(req.password))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"token": create_token(req.username.strip())}


@app.post("/api/auth/login")
async def login(req: AuthRequest):
    user = db.get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"token": create_token(req.username)}


@app.post("/api/auth/logout")
async def logout():
    return {"status": "ok"}


@app.get("/api/auth/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}


# ---------------------------------------------------------------------------
# Health / AI ping
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Boards
# ---------------------------------------------------------------------------

@app.get("/api/boards", response_model=list[BoardInfo])
def list_boards(username: str = Depends(get_current_user)):
    return db.get_boards_for_user(username)


@app.post("/api/boards", response_model=BoardInfo, status_code=status.HTTP_201_CREATED)
def create_board(req: CreateBoardRequest, username: str = Depends(get_current_user)):
    name = req.name.strip() or "My Board"
    return db.create_board_for_user(username, name)


@app.delete("/api/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(board_id: int, username: str = Depends(get_current_user)):
    if not db.delete_board(board_id, username):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")


@app.get("/api/boards/{board_id}", response_model=BoardData)
def get_board(board_id: int, username: str = Depends(get_current_user)):
    board = db.get_board_by_id(board_id, username)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


@app.put("/api/boards/{board_id}", response_model=BoardData)
def put_board(board_id: int, board: BoardData, username: str = Depends(get_current_user)):
    updated = db.save_board_by_id(board_id, username, board)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return updated


# ---------------------------------------------------------------------------
# AI chat
# ---------------------------------------------------------------------------

@app.post("/api/chat", response_model=AIResponse)
async def chat(req: ChatRequest, username: str = Depends(get_current_user)):
    board = db.get_board_by_id(req.board_id, username)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    try:
        result = await chat_with_board(board, req.history, req.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    if result.board_update is not None:
        saved = db.save_board_by_id(req.board_id, username, result.board_update)
        result = AIResponse(message=result.message, board_update=saved)
    return result


# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------

if os.path.isdir("static"):
    from fastapi.responses import FileResponse

    @app.get("/login")
    async def login_page():
        return FileResponse("static/login.html")

    app.mount("/", StaticFiles(directory="static", html=True), name="static")
