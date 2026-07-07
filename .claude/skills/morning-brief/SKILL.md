---
name: morning-brief
description: Produce a MATRIYA system health "morning brief" (health, latency, active gate violations, research/governance stats) and optionally email it. Use when the user asks for a daily/morning status, system health summary, or "how is matriya doing".
---

# Morning Brief

Generates a Hebrew daily health report for the MATRIYA backend from existing endpoints — no core logic touched.

## What it gathers
- `GET /health` — status, vector DB document count, request/error counts, latency p50/p99
- `GET /admin/recovery/violations?active_only=true` — currently locked gates (active violations)
- `GET /admin/reports/value-summary` — research runs, hard stops, recoveries, violations by reason

## How to run
The backend must be running and reachable via `BASE_URL` (default `http://localhost:8000`).

```bash
npm run brief:morning                 # print report to stdout
node scripts/morning-brief.mjs --out brief-$(date +%F).md   # also save markdown
node scripts/morning-brief.mjs --json # raw JSON (for automation / email body)
```

Admin data needs admin credentials: `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default `admin` / `admin123`).
Exit code: `0` healthy · `2` alerts present (active violations / unhealthy / high latency) · `1` run error.

## Delivering it (Agentic-OS step)
After running the script, you (Claude) can deliver the brief:
1. Run `node scripts/morning-brief.mjs --json` and read the result.
2. Render the report (or reuse stdout markdown).
3. If the user wants it emailed, send via the Gmail tool to the user, subject `MATRIYA — דוח בוקר <date>`.
Only email when the user asked for email delivery.

## Tuning thresholds
`BRIEF_P99_WARN_MS` (default 3000), `BRIEF_ERROR_RATE_WARN` (default 0.05).
