import { getToken } from "@/lib/auth";
import type { BoardData } from "@/lib/kanban";

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function getBoard(): Promise<BoardData> {
  const res = await fetch("/api/board", { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch board");
  return res.json();
}

export async function saveBoard(board: BoardData): Promise<BoardData> {
  const res = await fetch("/api/board", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(board),
  });
  if (!res.ok) throw new Error("Failed to save board");
  return res.json();
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AIResponsePayload = {
  message: string;
  board_update: BoardData | null;
};

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<AIResponsePayload> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}
