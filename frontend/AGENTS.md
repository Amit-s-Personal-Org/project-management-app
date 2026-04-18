# Frontend AGENTS.md

## Overview

A pure-frontend Kanban board demo built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. All state is in-memory — there is no backend integration yet. This is the starting point before backend/auth/AI work begins.

## Stack

- **Framework:** Next.js 16 (App Router, `src/` layout)
- **UI:** React 19, Tailwind CSS v4 (CSS-first config via `@import "tailwindcss"`)
- **Drag and drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **Fonts:** Space Grotesk (display headings), Manrope (body), loaded via `next/font/google`
- **Unit tests:** Vitest + @testing-library/react + jsdom
- **E2E tests:** Playwright
- **Linting:** ESLint with `eslint-config-next`

## Project Structure

```
src/
  app/
    layout.tsx       — Root layout: font vars, metadata ("Kanban Studio")
    page.tsx         — Renders <KanbanBoard /> at /
    globals.css      — CSS custom properties + Tailwind import
  components/
    KanbanBoard.tsx  — Top-level board: owns all state, DndContext, header
    KanbanColumn.tsx — A single column: droppable, SortableContext, rename input
    KanbanCard.tsx   — A single card: sortable, shows title/details, Remove button
    KanbanCardPreview.tsx — Drag overlay ghost (no drag listeners, no Remove button)
    NewCardForm.tsx  — Inline form to add a card (toggles open/closed)
    KanbanBoard.test.tsx — Vitest unit tests for the board component
  lib/
    kanban.ts        — Data types, initialData, moveCard(), createId()
    kanban.test.ts   — Vitest unit tests for moveCard()
  test/
    setup.ts         — Vitest setup (imports @testing-library/jest-dom matchers)
    vitest.d.ts      — Type augmentation for jest-dom matchers
tests/
  kanban.spec.ts     — Playwright e2e tests (loads board, adds card, drags card)
```

## Data Model

```ts
type Card   = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

Column order is defined by the `columns` array. Card order within a column is defined by `cardIds`. The `cards` map is a flat lookup by id.

`initialData` seeds 5 columns (Backlog, Discovery, In Progress, Review, Done) with 8 sample cards.

## Key Behaviors

- **Drag and drop:** `DndContext` in `KanbanBoard`. `moveCard()` in `kanban.ts` handles same-column reorder and cross-column moves. Drag overlay uses `KanbanCardPreview`.
- **Rename column:** Controlled `<input>` directly in `KanbanColumn`; calls `onRename` on every keystroke.
- **Add card:** `NewCardForm` toggles between a button and a form. Requires non-empty title. On submit calls `onAddCard`, which uses `createId("card")` to generate the id.
- **Delete card:** "Remove" button on `KanbanCard` calls `onDelete`; board filters the card out of both `cards` map and the column's `cardIds`.

## CSS / Theming

CSS custom properties are declared in `globals.css`:

| Variable              | Value     | Usage                                 |
|-----------------------|-----------|---------------------------------------|
| `--accent-yellow`     | `#ecad0a` | Column header bar, drop-zone highlight |
| `--primary-blue`      | `#209dd7` | Links, focus states, "Add a card" btn  |
| `--secondary-purple`  | `#753991` | Submit buttons (Add card)              |
| `--navy-dark`         | `#032147` | Headings, card titles                  |
| `--gray-text`         | `#888888` | Subtext, labels, card counts           |
| `--surface`           | `#f7f8fb` | Page background                        |
| `--stroke`            | rgba navy 8% | Borders                             |
| `--shadow`            | navy drop shadow | Card/column shadows              |

## Test Commands

```bash
npm run test:unit       # vitest run (unit + component tests)
npm run test:e2e        # playwright test (requires dev server running)
npm run test:all        # both
```

## What Is Not Yet Implemented

- Authentication / login page
- API calls to any backend
- AI chat sidebar
- Persistent state (everything resets on page refresh)
