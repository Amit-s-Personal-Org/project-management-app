# Code Review Report - PM (Kanban Studio)

This report summarizes the findings of a comprehensive code review of the PM repository.

## 1. Architecture & Scalability

### **Critical: Inefficient State Synchronization (Full State PUT)**
- **Issue:** The application uses a "Full State PUT" pattern. Every minor interaction (dragging a card, renaming a column) triggers a `PUT /api/boards/{id}` request containing the entire board JSON. The backend then deletes all existing columns and cards for that board and re-inserts them.
- **Impact:** This will not scale as the number of cards grows. It causes unnecessary database churn and resets auto-incrementing IDs on every save, which can break client-side state stability and external integrations.
- **Action:** 
    - [ ] Implement incremental update endpoints (e.g., `PATCH /api/cards/{id}` for renames, `POST /api/boards/{id}/move-card` for DND).
    - [ ] Update `db.py` to use `UPDATE` and `DELETE` selectively instead of a full wipe-and-reload.

### **Concurrency Control**
- **Issue:** There is no mechanism to prevent race conditions. If a user and the AI assistant update the board simultaneously, the last request to reach the server will overwrite the previous one entirely.
- **Impact:** Potential data loss and user frustration.
- **Action:**
    - [ ] Add a `version` or `updated_at` column to the `boards` table.
    - [ ] Implement optimistic concurrency control in the `PUT` and `PATCH` endpoints.

## 2. AI Integration

### **Brittle JSON Parsing**
- **Issue:** `backend/ai.py` uses regular expressions to extract JSON from the AI response. This is highly susceptible to failure if the LLM includes preamble text or slightly deviates from the expected format.
- **Action:**
    - [ ] Switch to a more robust parsing strategy or use LLM "Structured Outputs" features (like OpenAI's `response_format: { type: "json_object" }`).
    - [ ] Improve the system prompt to provide clearer examples and stricter constraints.

### **ID Management**
- **Issue:** The AI is instructed to "assign IDs by incrementing from the highest existing card number." Since the backend resets IDs on every save, the AI's "highest existing number" is often out of sync with the database's internal state.
- **Action:**
    - [ ] Let the backend handle ID assignment during the save process, or move to UUIDs for stable, client-generatable identifiers.

## 3. Security

### **Hardcoded Secrets**
- **Issue:** `backend/auth.py` contains a default hardcoded `SECRET_KEY`.
- **Action:**
    - [ ] Remove the default value and ensure the application fails to start if `SECRET_KEY` is not provided via environment variables in production.

### **JWT Storage**
- **Issue:** JWT tokens are stored in `localStorage` in the frontend, making them vulnerable to Cross-Site Scripting (XSS) attacks.
- **Action:**
    - [ ] Consider moving to `httpOnly` cookies for storing the session token.

## 4. Frontend Code Quality

### **"God Component" Pattern**
- **Issue:** `KanbanBoard.tsx` is a large component handling state management, drag-and-drop logic, API communication, and UI rendering.
- **Action:**
    - [ ] Refactor logic into custom hooks (e.g., `useBoardState`, `useBoardActions`).
    - [ ] Break down the component into smaller, focused presentation and container components.

## 5. Testing & Validation

### **Missing Integration Tests**
- **Issue:** Backend tests for the AI `chat` endpoint are missing. Existing AI tests only cover the "ping" health check.
- **Action:**
    - [ ] Add backend tests that mock the OpenRouter API to verify the `chat_with_board` logic and its interaction with the database.

### **Weak Model Validation**
- **Issue:** Pydantic models do not validate the consistency of the board state (e.g., checking if all `cardIds` in columns exist in the `cards` dictionary).
- **Action:**
    - [ ] Add Pydantic `@model_validator` to `BoardData` to ensure structural integrity.

---
**Reviewer:** Gemini CLI
**Date:** 2026-04-20
