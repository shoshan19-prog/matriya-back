# Pattern: Daily Triage

**Cadence:** every 1–2 hours, or once daily · **Autonomy:** L1 (report only) · **Cost:** Low

## Goal (the recursive purpose)

Keep a current picture of the repo's health so nothing rots silently. The loop
observes; it does **not** change code.

## Stop condition

The run is "done" when it has produced a triage report covering all four checks
below and appended a row to `loop-run-log.md`. One pass per run — no iteration.

## What it does each run

1. Read `STATE.md` (open items, suppressions) so it doesn't re-raise known issues.
2. Gather signal:
   - `npm test` — do unit/check scripts pass?
   - `git log --since="last run"` — what changed?
   - Open issues / PRs (via GitHub MCP) — anything stale (> 7 days, no activity)?
   - `npm outdated` — dependencies drifting?
3. Triage into: 🔴 needs action · 🟡 watch · 🟢 healthy.
4. Write findings to `STATE.md` (Open items) and append to `loop-run-log.md`.
5. If nothing new for the day, say so — silence is a valid, logged result.

## Guardrails

- L1 only: never edits code, never opens PRs. Reports to `STATE.md`.
- Budget: ~30k tokens/run (see `loop-budget.md`). Over budget → write partial + stop.
- Respect suppressions in `STATE.md`.

## Run it

```
/loop-daily-triage
```
Scheduled variant: `.github/workflows/loop-daily-triage.yml`.

## Promotion path

After it has run cleanly for a week, you may promote individual *actions* (e.g.
"open an issue for stale PRs") to L2 — but keep the triage itself read-only.
