"use client";

import { useEffect, useRef, useState } from "react";
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
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AISidebar } from "@/components/AISidebar";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import { getBoard, saveBoard } from "@/lib/api";

type KanbanBoardProps = {
  onLogout?: () => void;
  onBoardUpdate?: (board: BoardData) => void;
};

export const KanbanBoard = ({ onLogout, onBoardUpdate }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flashedColumns, setFlashedColumns] = useState<Set<string>>(new Set());
  const boardRef = useRef<BoardData | null>(null);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function applyBoard(next: BoardData) {
    boardRef.current = next;
    setBoard(next);
    onBoardUpdate?.(next);
  }

  useEffect(() => {
    getBoard().then(applyBoard);
  }, []);

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
    applyBoard(await saveBoard(next));
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
      if (boardRef.current) applyBoard(await saveBoard(boardRef.current));
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
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: board.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: [...c.cardIds, id] } : c
      ),
    };
    applyBoard(next);
    applyBoard(await saveBoard(next));
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
    applyBoard(await saveBoard(next));
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

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between
                stages, and capture quick notes without getting buried in
                settings.
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <button
                type="button"
                aria-label="Open AI assistant"
                onClick={() => setSidebarOpen(true)}
                className="rounded-full border border-[var(--primary-blue)] bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
              >
                AI Assistant
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
                >
                  Log out
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className={flashedColumns.has(column.id) ? "column-flash" : ""}
              >
                <KanbanColumn
                  column={column}
                  cards={column.cardIds.map((id) => board.cards[id])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              </div>
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
      <AISidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onBoardUpdate={handleAIBoardUpdate}
      />
    </div>
  );
};
