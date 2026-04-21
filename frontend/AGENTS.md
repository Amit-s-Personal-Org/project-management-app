# Frontend AGENTS.md

## Overview

The Next.js frontend for Kanban Studio. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and `@dnd-kit` for drag-and-drop. The app is compiled to a static export (`output: "export"`) and served by the FastAPI backend in production.

## Stack

- **Framework:** Next.js 16 (App Router, `src/` layout, static export)
- **UI:** React 19, Tailwind CSS v4 (`@import "tailwindcss"` config)
- **Icons:** `lucide-react`
- **Drag and drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **Fonts:** Space Grotesk (display headings), Manrope (body), loaded via `next/font/google`
- **Unit tests:** Vitest + @testing-library/react + jsdom
- **E2E tests:** Playwright (runs against Docker on port 8000)
- **Linting:** ESLint with `eslint-config-next`

## Project Structure

```
src/
  app/
    layout.tsx         — Root layout: font vars, metadata, anti-flash theme script
    page.tsx           — Auth gate: calls getMe(), redirects to /login if unauthed
    globals.css        — CSS custom properties (light + dark), Tailwind import
    login/
      page.tsx         — Login / sign-up form with ThemeToggle
  components/
    KanbanBoard.tsx    — Top-level board: owns all state, DndContext, header, ThemeToggle
    KanbanColumn.tsx   — Single column: droppable, SortableContext, rename input
    KanbanCard.tsx     — Single card: sortable, title/details, hover-reveal delete icon
    KanbanCardPreview.tsx — Drag overlay ghost
    NewCardForm.tsx    — Inline form to add a card (toggle open/closed)
    AISidebar.tsx      — Fixed right-side chat panel; sends POST /api/chat
    BoardSelector.tsx  — Header dropdown to switch, create, and delete boards
    ThemeToggle.tsx    — Sun/moon icon button; persists theme to localStorage
  lib/
    api.ts             — Typed fetch wrapper for all API calls (boards, chat)
    auth.ts            — login(), signup(), logout(), getMe() helpers (localStorage JWT)
    kanban.ts          — Data types (Card, Column, BoardData), moveCard(), createId()
    kanban.test.ts     — Vitest tests for moveCard()
  test/
    setup.ts           — Vitest setup (jest-dom matchers)
    vitest.d.ts        — Type augmentation for jest-dom
tests/
  kanban.spec.ts       — Playwright E2E tests
```

## Data Model

```ts
type Card     = { id: string; title: string; details: string }
type Column   = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
type BoardInfo = { id: number; name: string }
```

Column order is defined by `columns[]`. Card order within a column is defined by `cardIds[]`. `cards` is a flat id → Card map.

## Key Behaviours

- **Auth:** `page.tsx` calls `getMe()` on mount and redirects to `/login` if the JWT is missing or expired. JWT is stored in `localStorage` as `pm_token`.
- **Board persistence:** Every state mutation (drag, add, rename, delete) immediately calls `saveBoard(boardId, newState)` via `PUT /api/boards/{id}`.
- **Drag and drop:** `DndContext` in `KanbanBoard`. `moveCard()` handles same-column reorder and cross-column moves. `PointerSensor` with `distance: 6` activation prevents accidental drags on tap.
- **Delete card:** Icon button on `KanbanCard` — uses `onPointerDown` stop-propagation so it does not trigger drag. Hidden on desktop until card hover; always visible on mobile (`sm:opacity-0 sm:group-hover:opacity-100`).
- **Rename column:** Controlled `<input>` with 500 ms debounce before persisting.
- **AI chat:** `AISidebar` sends `POST /api/chat` with the current message and history. If the response includes `board_update`, `KanbanBoard` replaces board state and flashes affected columns.
- **Board switching:** `BoardSelector` lists all boards; switching re-fetches from `GET /api/boards/{id}`.
- **Dark/light mode:** `ThemeToggle` flips `data-theme` on `<html>` and saves to `localStorage`. An inline script in `layout.tsx` sets the initial theme before first paint to avoid flash.

## CSS / Theming

All colours are CSS custom properties redefined per theme in `globals.css`.

| Variable            | Light value         | Dark value   | Usage                              |
|---------------------|---------------------|--------------|------------------------------------|
| `--accent-yellow`   | `#ecad0a`           | `#f0b913`    | Column bar, drop-zone ring         |
| `--primary-blue`    | `#209dd7`           | `#3ab4e8`    | Links, focus states, AI button     |
| `--secondary-purple`| `#753991`           | `#9b60c8`    | Submit buttons                     |
| `--navy-dark`       | `#032147`           | `#dde6f0`    | Headings, card titles (text colour)|
| `--gray-text`       | `#888888`           | `#7a90a8`    | Labels, subtext, card counts       |
| `--surface`         | `#f7f8fb`           | `#0e1825`    | Page background, column fill       |
| `--surface-strong`  | `#ffffff`           | `#172233`    | Cards, dropdowns, elevated panels  |
| `--surface-header`  | `rgba(255,255,255,0.85)` | `rgba(23,34,51,0.85)` | Frosted header / login card |
| `--stroke`          | `rgba(3,33,71,0.08)`| `rgba(148,180,220,0.12)` | Borders               |
| `--shadow`          | navy drop shadow    | black drop shadow | Card/column shadows            |

Never use hardcoded `bg-white` — use `bg-[var(--surface-strong)]` or `bg-[var(--surface-header)]`.

## Mobile Layout

- Below `lg` (1024 px): board columns use `flex overflow-x-auto`; each column is `78vw` wide (max 320 px). A negative-margin wrapper (`-mx-3 sm:-mx-6`) lets the scroll area extend flush to screen edges.
- At `lg+`: grid layout (`grid-cols-5`) with no horizontal scroll.
- AI sidebar is `w-full` on mobile, `w-[360px]` on `sm+`.
- All `<input>` and `<textarea>` use `text-base sm:text-sm` to prevent iOS Safari auto-zoom.
- `min-h-[100dvh]` used throughout (not `min-h-screen`) to respect mobile browser chrome.

## Test Commands

```bash
npm run test:unit          # vitest run
npm run test:unit:watch    # vitest watch mode
npm run test:e2e           # playwright (Docker must be running on port 8000)
npm run build              # static export to /out (also runs TypeScript check)
npm run lint               # ESLint
```
