# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ExploreYC — a full-stack web app that scrapes Y Combinator's Algolia API for company data and provides analytics, AI-powered tools (idea validation, success prediction), interactive maps/charts, email digests, and a hiring board.

## Tech Stack

- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind CSS (monospace/hacker theme with YC orange `#FF6600`)
- **Backend:** FastAPI (Python 3.11) — nearly all endpoints live in `backend/main.py`
- **Database:** SQLite locally, PostgreSQL (Supabase) in production — chosen via `database_factory.py` based on `DATABASE_URL`
- **Deployment:** Vercel (frontend + API rewrites to `api.exploreyc.com`) + Render (backend) + GitHub Actions (cron)
- **Key integrations:** OpenAI (idea validation/embeddings), Perplexity AI (research), CoreSignal (company enrichment), Resend (email), Algolia (YC data source)

## Development Commands

```bash
# Frontend dev server (proxies /api and /ws to localhost:8000)
cd frontend && npm install && npm run dev

# Backend dev server
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python3 -m uvicorn main:app --reload

# Production frontend build (from repo root)
npm run build

# Run backend tests (from backend/)
python -m pytest test_email_digest.py
python -m pytest test_pagination.py
```

No frontend test suite exists. Backend tests are integration-focused (`test_*.py` files in `backend/`).

**Seeding local data:** With `DATABASE_URL` unset the backend uses SQLite (`backend/yc_companies.db`, auto-created). Scrape YC data from the public Algolia API (no keys needed):

```bash
# Seed last 3 batches (with backend running)
curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"batch": ["Winter 2025", "Summer 2024", "Winter 2024"], "hits_per_page": 1000, "max_pages": 20}'

# Check progress
curl http://localhost:8000/api/scrape/status/1
```

## Architecture

### Backend (`backend/`)

`main.py` (~3000 lines) is the monolithic FastAPI app containing all API endpoints. Key endpoint groups:
- `/api/companies`, `/api/scrape` — core company data & scraping
- `/api/admin/*` — admin dashboard (session-based auth, 24h expiry)
- `/api/cron/*` — scheduled jobs (protected by `CRON_SECRET` bearer token)
- `/api/validate-idea`, `/api/gamified-predict` — AI-powered tools
- `/api/subscribe`, `/api/verify-email` — email digest system
- `WebSocket /ws/scrape` — real-time scraping progress

Database layer uses a factory pattern:
- `database_factory.py` → selects `database.py` (SQLite) or `database_postgres.py` (PostgreSQL)
- Migrations in `supabase/migrations/`

Services are split into separate files: `scraper_service.py`, `email_service.py`, `embedding_service.py`, `hiring_service.py`, `coresignal_service.py`, `perplexity_service.py`.

### Frontend (`frontend/`)

SPA with React Router. Entry: `main.tsx` → `App.tsx` (routes + global features).
- `src/pages/` — 23+ route pages
- `src/components/ui/` — Radix UI primitives
- `src/components/intelligence/` — company research features
- `src/contexts/AppContext` — global state
- Data fetching via TanStack React Query + Axios
- Charts: Recharts. Maps: React Leaflet. Graphs: ReactFlow.

### Scheduled Jobs

GitHub Actions (`.github/workflows/daily-cron.yml`):
- 2:00 AM UTC — daily scrape (`/api/cron/daily-scrape`)
- 10:00 AM UTC — send digest emails (`/api/cron/send-digests`)

Also has Vercel cron handlers in `api/cron/`.

## Environment Variables

See `.env.example` for the full list. Key ones:
- `DATABASE_URL` / `DIRECT_DATABASE_URL` — Supabase PostgreSQL
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin auth
- `RESEND_API_KEY` — email service
- `CORESIGNAL_API_KEY` — company enrichment
- `CRON_SECRET` — cron job auth
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate-limit storage (optional; falls back to in-memory)
- `VITE_API_URL` — backend URL for browser requests (frontend env var)
- `FRONTEND_URL` — used for CORS configuration

## Vite Dev Proxy

The Vite config proxies `/api` and `/ws` to `http://localhost:8000`, so the frontend dev server talks to the local backend automatically.
