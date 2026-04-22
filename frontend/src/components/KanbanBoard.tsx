"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Sparkles, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AISidebar } from "@/components/AISidebar";
import { BoardSelector } from "@/components/BoardSelector";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { getBoard, saveBoard, type BoardInfo } from "@/lib/api";

type KanbanBoardProps = {
  boardId: number;
  boards: BoardInfo[];
  username?: string;
  onBoardsChange: (boards: BoardInfo[]) => void;
  onSwitchBoard: (board: BoardInfo) => void;
  onLogout?: () => void;
  onBoardUpdate?: (board: BoardData) => void;
};

export const KanbanBoard = ({ boardId, boards, username, onBoardsChange, onSwitchBoard, onLogout, onBoardUpdate }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flashedColumns, setFlashedColumns] = useState<Set<string>>(new Set());
  const boardRef = useRef<BoardData | null>(null);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const boardName = useMemo(
    () => boards.find((b) => b.id === boardId)?.name ?? "My Board",
    [boards, boardId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function applyBoard(next: BoardData) {
    boardRef.current = next;
    setBoard(next);
    onBoardUpdate?.(next);
  }

  useEffect(() => {
    getBoard(boardId).then(applyBoard);
  }, [boardId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!board || !over || active.id === over.id) return;

    const next = {
      ...board,
      columns: moveCard(board.columns, active.id as string, over.id as string),
    };
    applyBoard(next);
    applyBoard(await saveBoard(boardId, next));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!board) return;
    const next = {
      ...board,
      columns: board.columns.map((c) =>
        c.id === columnId ? { ...c, title } : c
      ),
    };
    applyBoard(next);

    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    renameTimerRef.current = setTimeout(async () => {
      if (boardRef.current) applyBoard(await saveBoard(boardId, boardRef.current));
    }, 500);
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string
  ) => {
    if (!board) return;
    const id = createId("card");
    const next = {
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details },
      },
      columns: board.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: [...c.cardIds, id] } : c
      ),
    };
    applyBoard(next);
    applyBoard(await saveBoard(boardId, next));
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    if (!board) return;
    const next = {
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((c) =>
        c.id === columnId
          ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) }
          : c
      ),
    };
    applyBoard(next);
    applyBoard(await saveBoard(boardId, next));
  };

  const handleAIBoardUpdate = (updatedBoard: BoardData) => {
    if (!board) return;
    const oldColMap = new Map(board.columns.map((c) => [c.id, c.cardIds.join(",")]));
    const changed = new Set<string>(
      updatedBoard.columns
        .filter((c) => oldColMap.get(c.id) !== c.cardIds.join(","))
        .map((c) => c.id)
    );
    applyBoard(updatedBoard);
    if (changed.size > 0) {
      setFlashedColumns(changed);
      setTimeout(() => setFlashedColumns(new Set()), 900);
    }
  };

  const activeCard = board && activeCardId ? board.cards[activeCardId] : null;

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col gap-4 sm:gap-6 px-3 sm:px-6 pb-16 pt-4 sm:pt-8">

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between gap-2 sm:gap-4 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-header)] px-4 py-3 sm:px-6 sm:py-4 shadow-[var(--shadow)] backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Kanban Studio
            </p>
            <h1 className="font-display text-base sm:text-xl font-semibold text-[var(--navy-dark)] truncate">
              {boardName}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <BoardSelector
              boards={boards}
              activeBoardId={boardId}
              onSwitch={onSwitchBoard}
              onBoardsChange={onBoardsChange}
            />
            <button
              type="button"
              aria-label="Open AI assistant"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--primary-blue)] bg-[var(--primary-blue)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">AI</span>
            </button>
            {onLogout && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {username && (
                  <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)]">
                    <User size={13} />
                    <span className="hidden md:inline">{username}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Log out"
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Board — horizontal scroll on mobile, grid on desktop */}
        <div className="overflow-x-auto -mx-3 sm:-mx-6 px-3 sm:px-6 lg:overflow-x-visible lg:mx-0 lg:px-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="flex gap-3 sm:gap-4 pb-4 lg:grid lg:grid-cols-5 lg:pb-0">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((id) => board.cards[id])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  className={`w-[78vw] max-w-[320px] shrink-0 lg:w-auto lg:max-w-none lg:shrink${flashedColumns.has(column.id) ? " column-flash" : ""}`}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[240px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      <AISidebar
        isOpen={sidebarOpen}
        boardId={boardId}
        onClose={() => setSidebarOpen(false)}
        onBoardUpdate={handleAIBoardUpdate}
      />
    </div>
  );
};
