import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-transparent bg-[var(--surface-strong)] px-4 py-3 shadow-[0_18px_32px_rgba(3,33,71,0.16)] opacity-90 rotate-1">
    <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
      {card.title}
    </h4>
    {card.details && card.details !== "No details yet." && (
      <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
        {card.details}
      </p>
    )}
  </article>
);
