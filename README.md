# Insightly — UX Research AI Moderator

An AI-powered UX research platform. Researchers create studies, invite participants by email, and an AI voice moderator (Claude) conducts remote interviews autonomously, then generates structured insights.

[![Deploy to Replit](https://replit.com/badge/github/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME)](https://replit.com/github/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME)

> **After pushing to GitHub**: replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` in the badge URL above with your actual GitHub username and repository name.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS v4, TanStack Query, wouter |
| API | Node.js, Express 5, TypeScript |
| Database | PostgreSQL (Drizzle ORM) |
| AI Moderator | Anthropic Claude (`claude-sonnet-4-6`) |
| Voice I/O | Browser Web Speech API (STT + TTS) |
| Avatar videos | HeyGen API (optional) |
| Email | Resend API / SMTP fallback |

---

## Deploy options

### Option A — Vercel (frontend) + Render (backend) + Supabase (database) — recommended

This is the standard split-deployment setup. The frontend is a static React build on Vercel, the API server runs as a Node service on Render, and PostgreSQL is hosted on Supabase.

#### 1. Supabase — database

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project → Settings → Database → Connection string → URI** and copy the connection string.
3. Run the schema push once before your first deploy:
   ```bash
   DATABASE_URL="<your-supabase-url>" pnpm --filter @workspace/db run push
   ```

#### 2. Render — backend API

1. Create a new **Web Service** at [render.com](https://render.com) and connect your GitHub repo.
   - Render detects `render.yaml` and pre-fills the build/start commands automatically.
2. Set these environment variables in the Render dashboard:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `ANTHROPIC_API_KEY` | Your Anthropic key |
   | `SESSION_SECRET` | Any long random string (`openssl rand -hex 32`) |
   | `ALLOWED_ORIGINS` | Your Vercel URL — fill in after step 3 (e.g. `https://insightly.vercel.app`) |
   | `FRONTEND_URL` | Your Vercel URL, used in invite email links |
   | `RESEND_API_KEY` | Your Resend API key |
   | `EMAIL_FROM` | Verified sender, e.g. `Insightly <onboarding@resend.dev>` |
   | `NODE_ENV` | `production` |

3. Deploy. Your API will be live at something like `https://insightly-api.onrender.com`.

#### 3. Vercel — frontend

1. Import your GitHub repo at [vercel.com](https://vercel.com).
   - Vercel detects `vercel.json` and pre-fills the build settings automatically.
2. Add one environment variable in the Vercel dashboard:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | Your Render API URL (e.g. `https://insightly-api.onrender.com`) |

3. Deploy. Your frontend will be live at something like `https://insightly.vercel.app`.

4. Go back to your Render service and update `ALLOWED_ORIGINS` to your actual Vercel URL, then redeploy the backend.

---

### Option B — Replit (easiest, all-in-one)

1. Click the **Deploy to Replit** badge above.
2. Replit forks the repo, installs dependencies, and opens the project.
3. Add your secrets in **Tools → Secrets** (see the environment variables table below).
4. Click **Run** — both the API and frontend start automatically.

---

### Option C — Run on your laptop

#### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 — `npm install -g pnpm`
- **PostgreSQL** running locally, or a free hosted DB on [Neon](https://neon.tech) or [Supabase](https://supabase.com)

#### 1. Clone & install

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME insightly
cd insightly
pnpm install
```

#### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in the variables from the table below.

#### 3. Push the database schema

```bash
source .env
pnpm --filter @workspace/db run push
```

#### 4. Start both servers

```bash
source .env && pnpm run dev:local
```

Open **http://localhost:3000** in your browser. The frontend proxies all `/api/*` requests to the API server automatically.

---

## Environment variables reference

### Backend (API server)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase, Neon, Railway, or local) |
| `SESSION_SECRET` | ✅ | Long random string to sign session cookies |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic Claude API key — [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_MODEL` | ❌ | Claude API model ID (default `claude-sonnet-4-6`) |
| `ALLOWED_ORIGINS` | ✅ (production) | Comma-separated list of permitted frontend origins, e.g. `https://insightly.vercel.app` |
| `FRONTEND_URL` | ✅ (production email) | Public frontend URL used in invite emails, e.g. `https://insightly.vercel.app` |
| `NODE_ENV` | ✅ (production) | Set to `production` on hosted environments |
| `PORT` | ❌ | API server port (default `8080`) |
| `LIVEAVATAR_API_KEY` | ❌ | HeyGen API key for AI avatar video — [app.heygen.com](https://app.heygen.com) |
| `SMTP_USER` | ❌ | Email address used to send invites |
| `SMTP_PASS` | ❌ | SMTP password / Gmail App Password |
| `SMTP_HOST` | ❌ | SMTP server hostname (default `smtp.gmail.com`) |
| `SMTP_PORT` | ❌ | SMTP server port (default `587`) |
| `SMTP_SECURE` | ❌ | Use TLS — set `true` for port 465 |

For Render Free, prefer Resend over SMTP:

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | optional | Resend API key for invite emails over HTTPS. |
| `EMAIL_FROM` | optional | Sender address used for invite emails, e.g. `Insightly <onboarding@resend.dev>`. Required with `RESEND_API_KEY`. |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ (Vercel) | Full URL of the deployed API server, e.g. `https://insightly-api.onrender.com`. Leave unset when frontend and backend share a domain (Replit, local dev). |

> **Gmail App Password**: Google account → Security → 2-Step Verification → App passwords → create one labelled "Insightly". Use the 16-character code as `SMTP_PASS`.

---

## How the AI moderator works

The interview loop runs entirely in the browser:

```
Participant speaks
  → Browser Speech Recognition transcribes it
    → POST /api/sessions/:id/turn  (saves transcript + calls Claude)
      → Claude decides: follow-up question / next question / wrap up
        → AI response saved to DB
          → Browser Speech Synthesis speaks the response aloud
            → Mic opens again — participant speaks ...
```

The microphone is fully disabled while the AI is speaking to prevent the TTS audio from being picked up as participant input.

---

## Project structure

```
insightly/
├── artifacts/
│   ├── api-server/            # Express API (port 8080)
│   └── ux-moderator/          # React frontend (port 3000)
├── lib/
│   ├── db/                    # Drizzle schema + migrations
│   ├── api-zod/               # Shared Zod validation schemas
│   ├── api-client-react/      # Generated TanStack Query hooks
│   └── integrations-anthropic-ai/  # Anthropic client wrapper
├── scripts/
├── vercel.json                # Vercel frontend build config
├── render.yaml                # Render backend deploy config
└── .env.example               # All environment variables documented
```
