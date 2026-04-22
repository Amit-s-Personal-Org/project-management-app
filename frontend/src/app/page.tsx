"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/auth";
import { getBoards, type BoardInfo } from "@/lib/api";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function Home() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [username, setUsername] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe().then(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUsername(user.username);
      const list = await getBoards();
      setBoards(list);
      if (list.length > 0) setActiveBoardId(list[0].id);
      setReady(true);
    });
  }, [router]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!ready) return null;

  if (boards.length === 0 || activeBoardId === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          No boards found.
        </p>
      </div>
    );
  }

  return (
    <KanbanBoard
      boardId={activeBoardId}
      boards={boards}
      username={username}
      onBoardsChange={setBoards}
      onSwitchBoard={(board) => setActiveBoardId(board.id)}
      onLogout={handleLogout}
    />
  );
}
