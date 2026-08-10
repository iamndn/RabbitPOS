# AI Coding Standards & Project Rules

**CRITICAL RULE:** English is the ONLY allowed language for this project. All generated code, comments, documentation, commit messages, and variable names MUST be written in English.

## 1. Tech Stack Overview
- **Backend:** Go (Golang) using Fiber or Gin framework. Focus on high performance and low memory footprint.
- **Frontend:** Next.js (App Router), React, TypeScript. Tailwind CSS for styling.
- **Database:** PostgreSQL. Use GORM or SQLC for database interactions.

## 2. Backend Rules (Go)
- **Architecture:** Follow Clean Architecture principles: `cmd/` (entry points), `internal/models/` (DB structs), `internal/handlers/` (API logic), `internal/routes/`.
- **API Standards:** Design strictly RESTful APIs. 
- **Response Format:** All endpoints must return a standardized JSON structure: `{ "status": "success|error", "data": {...}, "message": "..." }`.
- **Error Handling:** Explicitly handle errors. Never use `panic` unless it's a fatal startup error.

## 3. Frontend Rules (Next.js & React)
- **Design Philosophy:** Mobile-first approach. Components (especially POS item grid and checkout cart) must be highly optimized for portrait mobile screens.
- **UI Libraries:** Utilize lightweight libraries like `shadcn/ui` and `Lucide React` for iconography.
- **Type Safety:** Strict TypeScript enforcement. Define clear interfaces/types for all API payloads and responses.

## 4. AI Development Workflow
When instructed to build a new feature, the AI must execute the following steps in order:
1. Analyze if database schema changes are required. If yes, generate the SQL Migration file first.
2. Develop the Backend API handler and define routes.
3. Develop the Frontend components and integrate the API.
4. Add concise inline comments explaining complex logic (in English).