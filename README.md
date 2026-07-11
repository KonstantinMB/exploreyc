<div align="center">

# ExploreYC

**Explore the Y Combinator portfolio.**
Search companies, validate ideas, predict success, browse the live hiring board.

### → [exploreyc.com](https://exploreyc.com) ←

[![Live Site](https://img.shields.io/badge/Live-exploreyc.com-FF6600?style=for-the-badge&logo=vercel&logoColor=white)](https://exploreyc.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](#contributing)
[![Report a vuln](https://img.shields.io/badge/Security-disclose%20privately-red.svg?style=for-the-badge)](SECURITY.md)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)

</div>

---

## Why this exists

There's no good way to slice the YC portfolio if you're not a YC partner with database access. Algolia search is fine for finding one company; it's bad for "show me every Fintech company hiring engineers in Europe that raised in the last six months." So I built one. It started as a CLI scraper and grew into a deployed web app.

This was a closed-source project until the Product Hunt launch made it clear there's an audience of YC-curious builders who want different cuts of this data than I do. So now you can build them.

## Features

- **Company explorer** — search, filter, and sort the full YC portfolio
- **Idea validator** — paste a startup idea, see the most semantically-similar YC companies (OpenAI embeddings)
- **Gamified success predictor** — score an idea + team profile against historical YC patterns
- **Live hiring board** — currently-open YC roles, filterable by company / role / location
- **Email digests** — subscribe to weekly updates on new batches
- **Maps & analytics** — geographic distribution, batch trends, industry breakdowns
- **Admin dashboard** — scrape jobs, subscription management, manual tools (auth-gated)

> Try it now: **[exploreyc.com](https://exploreyc.com)** — no signup required.

## Tech stack

| Layer | What |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind, TanStack Query, Radix UI, Recharts, React Leaflet, ReactFlow |
| Backend | FastAPI (Python 3.11), WebSocket support |
| Database | SQLite (local) → PostgreSQL via Supabase (prod). Selected at runtime by `backend/database_factory.py` |
| Hosting | Vercel (frontend + cron) + Render (backend) |
| LLM / enrichment | OpenAI, Perplexity, CoreSignal |
| Email | Resend |

---

## Quick start

You need Python 3.11+ and Node 20+.

```bash
git clone https://github.com/KonstantinMB/exploreyc.git
cd exploreyc

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in the keys you have
python3 -m uvicorn main:app --reload    # → http://localhost:8000

# Frontend (new shell)
cd ../frontend
npm install
npm run dev                  # → http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to `localhost:8000`, so the frontend talks to your local backend automatically.

**Minimum viable local setup:** leave `DATABASE_URL` unset (falls back to SQLite) and provide just an `OPENAI_API_KEY` for the idea-validator features. Every other integration degrades gracefully if its key is missing — see [`.env.example`](.env.example) for the full list.

---

### 🐳 Docker quick start (alternative)

No Python or Node required - just [Docker](https://docs.docker.com/get-docker/).

```bash
git clone https://github.com/KonstantinMB/exploreyc.git
cd exploreyc
cp .env.example .env   # add OPENAI_API_KEY etc. if you want - DATABASE_URL is set automatically
docker compose up
```

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |
| Postgres | localhost:5432        |

On first start `docker/init-db.sh` runs all Postgres-compatible migrations automatically. Data persists in a named volume across restarts; `docker compose down -v` wipes it.

If you add a new migration, append it to `docker/init-db.sh` and run `docker compose down -v && docker compose up`.

> For production deployment see [`DEPLOYMENT.md`](DEPLOYMENT.md).



### Seeding local data

The local SQLite database starts empty. To populate it, scrape YC company data from the public Algolia API (no API keys needed):

```bash
# With the backend running, seed the last 3 batches (~500+ companies)
curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"batch": ["Winter 2025", "Summer 2024", "Winter 2024"], "hits_per_page": 1000, "max_pages": 20}'

# Check progress (replace 1 with the job_id returned above)
curl http://localhost:8000/api/scrape/status/1

# Verify data loaded
curl http://localhost:8000/api/stats
```

Once the scrape completes (usually under a minute), refresh the frontend to see charts and data populate. To scrape all batches, omit the `batch` filter — but this takes longer and hits the 3-requests-per-hour rate limit.

## Project layout

```
backend/         FastAPI app — most endpoints in main.py, services as siblings
frontend/        React SPA, React Router
api/cron/        Vercel cron handlers (call back into the backend)
supabase/        Migrations, applied in filename order
scripts/         Maintenance helpers (embeddings backfill, funding enrichment)
.github/         Issue templates, CI, scheduled GitHub Actions cron
```

Detailed architecture notes are in [`CLAUDE.md`](CLAUDE.md) — written for AI assistants, useful for humans too.

---

## Contributing

PRs and ideas welcome. This is a one-person project and I'm not precious about it. **The goal is to grow this into the explorer the YC-curious community actually wants — your version, not just mine.**

### I have an idea but I don't write code

Open a new issue using the [`💡 Idea` template](https://github.com/KonstantinMB/exploreyc/issues/new/choose). Describe the user, the problem, and what you wish existed. Don't worry about feasibility — that's my problem. Half-baked is fine. Drawings, screenshots, links to similar features elsewhere — all welcome.

If you'd rather send it privately: `konstantin.borimechkov14@gmail.com`.

### I want to ship something

1. Skim the [open issues](https://github.com/KonstantinMB/exploreyc/issues) and the [Open ideas](#open-ideas) section below for inspiration.
2. **Open an issue first** if the change is non-trivial — saves you (and me) the cost of building something that won't merge.
3. Fork → branch (`feature/short-name` or `fix/short-name`) → PR against `master`.
4. Keep PRs focused. One feature or one fix per PR. Smaller diffs ship faster.
5. If your change touches the API surface, env vars, or migrations, update `.env.example` + the relevant section of this README (or `CLAUDE.md`) in the same PR.

I try to respond to issues within 48h and review PRs within a week. If I'm slow, ping me — it's not personal.

### What I'll merge enthusiastically

- New filters, views, or analytics on existing data
- New data integrations that fit the mission (other accelerators, public funding sources, etc.)
- Performance improvements (`backend/main.py` is a 3000-line monolith on purpose, not by accident — but most of it is ripe for tightening)
- Bug fixes with a test or reproduction
- Documentation / onboarding improvements
- A frontend test suite (there is none yet — first contributor gets eternal gratitude)

### What I'll push back on

- Breaking the "no required signup" model — ExploreYC works for unauthenticated visitors and I want to keep it that way for the core features
- Adding heavy dependencies for marginal gains
- Stylistic refactors without a behavioral reason
- Anything that puts user data, scraped data, or third-party API keys at risk
- Forking the data model in ways that complicate the SQLite-or-Postgres factory pattern

If you're unsure, open an issue and ask before building. I'd rather have the conversation than reject a PR you spent a weekend on.

### Local dev workflow

- Backend autoreloads with `uvicorn main:app --reload`
- Frontend hot-reloads with `npm run dev`
- Type-check the frontend before pushing: `cd frontend && npm run build`
- Run backend tests: `cd backend && python -m pytest`
- Migrations live in `supabase/migrations/` and are applied in filename order. When adding one, use the next timestamp prefix.

### Code conventions

There's no enforced lint config — match surrounding code style.

- **Backend:** PEP 8-ish, type hints where they help, log don't print, raise `HTTPException` for user-facing errors, group related endpoints in `main.py` with a `# ===== SECTION =====` comment
- **Frontend:** function components, hooks, Tailwind for styling, TanStack Query for any data that comes from the backend, Radix primitives over custom modals/popovers
- **Secrets:** the only env file in the repo is `.env.example`. Everything sensitive goes in your local `.env`, which is gitignored.
- **Rate-limited endpoints:** if you add an endpoint that calls a paid API (OpenAI / Perplexity / CoreSignal), wire it up with `_enforce_rate_limit(...)` — see `backend/main.py` near line 90 for the pattern.

---

## Open ideas

Things I've been thinking about but haven't built. Pick one, open an issue if you have questions, ship it. None of these are claimed.

- **Batch comparison view** — side-by-side stats for any two YC batches (size, vertical mix, hiring %, top hires, etc.)
- **Founder profile pages** — aggregate companies founded by the same person across batches
- **CLI mode** — bring back a packaged CLI for people who want JSON/CSV exports without running the full web app
- **Non-YC accelerator support** — Techstars, 500, Antler, EF. Plug-in architecture for the scraper
- **Better embedding model for the idea validator** — currently `text-embedding-3-small`; experiment with newer or open-source models
- **Notion / Slack / Discord integrations** — push the email digest to other channels
- **Public read-only API** — rate-limited dataset endpoints, no key required
- **Frontend test suite** — Vitest + React Testing Library. Doesn't have to cover everything; a baseline that runs in CI would be huge
- **Diff view on YC batches** — "what changed between Spring and Summer 2026"
- **Internationalization** — site is English-only; YC's reach isn't
- **Self-hosted deploy guide** — Docker Compose recipe for people who don't want Vercel + Render

If your idea isn't on the list, that doesn't mean no. Open an issue and let's talk.

---

## Testing

```bash
cd backend
python -m pytest test_email_digest.py
python -m pytest test_pagination.py
```

Backend tests are integration-flavored and may hit real services if the relevant keys are set. There's no frontend test suite yet (see [Open ideas](#open-ideas)).

## Deploying your own instance

The hosted version uses Vercel (frontend + Vercel cron + rewrites that proxy `/api/*` to `api.exploreyc.com`) and Render (backend). The repo is wired for that, but nothing prevents another layout.

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the step-by-step.

## Security

Found a vulnerability? See [`SECURITY.md`](SECURITY.md). Please disclose privately, not via a public issue.

## License

[MIT](LICENSE). Use it, fork it, build a business with it. Attribution is appreciated but not required.

## Acknowledgments

- Y Combinator and the founders whose public data this app surfaces
- Everyone who upvoted, broke things, and improved this during the Product Hunt launch
- The Algolia, Supabase, OpenAI, Perplexity, Resend, CoreSignal, Vercel, and Render teams — none of this exists without them

---

<div align="center">

**Like the project?**
Star it on GitHub · [Try it live](https://exploreyc.com) · [Open an issue](https://github.com/KonstantinMB/exploreyc/issues/new/choose) · Tell a friend

Built by [Konstantin Borimechkov](https://github.com/KonstantinMB).

</div>
