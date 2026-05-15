# Insightly — UX Research AI Moderator

A workspace for UX researchers to run automated remote interviews. Researchers create studies, invite participants by email, and an AI voice moderator (Anthropic Claude) conducts the interview, transcribes it, and generates structured insights.

## Architecture

- **Monorepo** (pnpm workspaces, TypeScript project references).
- **Frontend** (`artifacts/ux-moderator`): React + Vite + Tailwind + wouter + TanStack Query. UI components from shadcn/ui template.
- **API** (`artifacts/api-server`): Express + Drizzle + Zod, exposed at `/api/*`.
- **DB** (`lib/db`): PostgreSQL via Drizzle ORM. Tables: `studies`, `participants`, `sessions`, `transcript_turns`, `insights`. IDs are nanoid strings.
- **API contract** (`lib/api-spec/openapi.yaml`) is the source of truth; client + zod schemas are generated into `lib/api-client-react` and `lib/api-zod`.
- **AI** (`lib/integrations-anthropic-ai`): Replit AI Integrations proxy for Anthropic. Model used: `claude-sonnet-4-6`.

## Key flows

- **Study creation** → `POST /api/studies` with title, product, goal, questions, time slots.
- **Invites**: `POST /api/studies/:id/participants` adds emails, `POST /api/studies/:id/send-invites` returns shareable invite URLs (email is simulated — links are shown back in the UI to copy).
- **Live interview** (`/interview/:sessionId`): browser SpeechRecognition for input, `speechSynthesis` for output. After each participant turn, the AI moderator decides to follow up (max 2 per question), advance to the next question, or wrap up.
- **Insights**: `POST /api/sessions/:id/insights/generate` reads the transcript and returns summary, pain points, user goals, feature requests, recommendations.

## Important conventions

- Frontend routing is via wouter, base set to `import.meta.env.BASE_URL`. wouter v3 `Link` renders an `<a>` directly — never nest another `<a>` inside.
- API client hooks return `T` directly (not wrapped). Mutations: `mutate({ data, ...pathParams })`.
- The Anthropic integration package vendors p-retry; uses named `AbortError` import.
