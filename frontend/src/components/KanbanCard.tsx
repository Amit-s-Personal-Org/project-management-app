import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-transparent bg-[var(--surface-strong)] px-4 py-3 shadow-[0_4px_12px_rgba(3,33,71,0.07)]",
        "transition-all duration-150 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0 rounded-full p-1.5 text-[var(--gray-text)] opacity-100 sm:opacity-0 sm:transition-all sm:duration-100 sm:group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
          aria-label={`Delete ${card.title}`}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>
    </article>
  );
};
