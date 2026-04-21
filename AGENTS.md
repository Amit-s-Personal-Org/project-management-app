# The Project Management MVP web app

## Business Requirements

This project is building a Project Management App. Key features:
- A user can sign in
- When signed in, the user sees a Kanban board representing their project
- The Kanban board has fixed columns that can be renamed
- The cards on the Kanban board can be moved with drag and drop, and edited
- There is an AI chat feature in a sidebar; the AI is able to create / edit / move one or more cards

## Current Feature Set

- Any user can sign up and log in (bcrypt-hashed passwords, JWT auth)
- Each user can create, rename, switch between, and delete multiple named boards
- Runs locally in a Docker container

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in .env in the project root
- Use `openai/gpt-oss-120b:free` as the model
- Use SQLLite local database for the database, creating a new db if it doesn't exist
- Start and Stop server scripts for Mac, PC, Linux in scripts/

## Starting Point

A working MVP of the frontend has been built and is already in frontend. This is not yet designed for the Docker setup. It's a pure frontend-only demo.

## Color Scheme

All colours are CSS custom properties in `frontend/src/app/globals.css`. Light and dark values:

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--accent-yellow` | `#ecad0a` | `#f0b913` | Accent lines, highlights |
| `--primary-blue` | `#209dd7` | `#3ab4e8` | Links, key sections |
| `--secondary-purple` | `#753991` | `#9b60c8` | Submit buttons, important actions |
| `--navy-dark` | `#032147` | `#dde6f0` | Main headings, body text |
| `--gray-text` | `#888888` | `#7a90a8` | Supporting text, labels |
| `--surface` | `#f7f8fb` | `#0e1825` | Page background |
| `--surface-strong` | `#ffffff` | `#172233` | Cards, dropdowns, panels |
| `--surface-header` | `rgba(255,255,255,0.85)` | `rgba(23,34,51,0.85)` | Frosted header / login card |

Never use hardcoded `bg-white` in components — always use `bg-[var(--surface-strong)]` or `bg-[var(--surface-header)]`.

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

All documents for planning and executing this project will be in the docs/ directory.
Please review the docs/PLAN.md document before proceeding.