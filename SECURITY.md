# Security Policy

## Reporting a vulnerability

If you find a security issue in ExploreYC, **please do not open a public GitHub issue**.

Instead, email **konstantin.borimechkov14@gmail.com** with:

- A description of the issue and its impact
- Steps to reproduce (or a minimal proof-of-concept)
- The affected endpoint, file, or commit if known

I aim to acknowledge reports within 72 hours and to ship a fix or mitigation within 14 days for high-severity issues. Coordinated disclosure is appreciated — please give me a chance to patch the hosted deployment at https://exploreyc.com before publishing details.

## Scope

In scope:

- The hosted app at `exploreyc.com` and `api.exploreyc.com`
- Source code in this repository (backend, frontend, cron handlers, migrations)

Out of scope:

- Findings that require physical access to a user's machine
- Reports from automated scanners without a working proof-of-concept
- Rate-limit or denial-of-service reports against the hosted instance (please don't attempt these)
- Third-party services this project integrates with (Supabase, Vercel, Render, Resend, OpenAI, Perplexity, CoreSignal) — report those upstream

## What's already public

Anything in `git log` for this repository is, by definition, public. If you see a leaked credential in history, please report it privately — the same channel above.
