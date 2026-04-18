import json
import os
import re

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openrouter/free"


async def call_ai(messages: list[dict]) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not set")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "Project Management App",
            },
            json={"model": MODEL, "messages": messages},
            timeout=45.0,
        )
        response.raise_for_status()

    return response.json()["choices"][0]["message"]["content"]


async def chat_with_board(board: "BoardData", history: list[dict], message: str) -> "AIResponse":
    from models import AIResponse, BoardData  # noqa: F401 (type reference)

    board_json = json.dumps(board.model_dump(), indent=2)

    system_prompt = f"""You are a project management assistant helping a user manage their Kanban board.

Current board state:
{board_json}

Board structure:
- columns: ordered list of columns, each with id (e.g. "col-1"), title, and cardIds
- cards: dict mapping card ID (e.g. "card-1") to card with id, title, details

Respond ONLY with a valid JSON object — no markdown, no prose outside the JSON:
{{
  "message": "your reply to the user",
  "board_update": null
}}

If the user asks you to change the board (move cards, add cards, rename, etc.), set board_update to the complete updated board including ALL columns and cards. Otherwise keep board_update as null. When adding new cards, assign IDs by incrementing from the highest existing card number."""

    messages_to_send = [{"role": "system", "content": system_prompt}]
    messages_to_send.extend(history)
    messages_to_send.append({"role": "user", "content": message})

    raw = await call_ai(messages_to_send)

    # Robust JSON extraction handling conversational wrappers and markdown
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", raw, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    else:
        # Fallback to finding the first { and last }
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            cleaned = raw[start:end+1]
        else:
            cleaned = raw.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"AI returned invalid JSON: {exc}") from exc

    return AIResponse.model_validate(data)
