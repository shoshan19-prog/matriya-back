---
description: Daily Triage loop — report repo health (L1, read-only)
---

You are running the **Daily Triage** loop for matriya-back. This is **L1: report only**.
You must NOT edit code, open PRs, or push. Full spec: `loops/patterns/daily-triage.md`.

Steps:
1. Read `loops/STATE.md` — note Open items and Suppressions; do not re-raise suppressed items.
2. Gather signal:
   - Run `npm test` and capture pass/fail.
   - `git log --oneline -20` — recent changes.
   - Open issues/PRs via GitHub MCP — flag anything stale (>7 days, no activity).
   - `npm outdated` — note drifting deps.
3. Triage findings into 🔴 needs action / 🟡 watch / 🟢 healthy, and tag EACH with an evidence level `[VERIFIED|PARTIAL|UNVERIFIED]` (see "Evidence level" in `loops/LOOP.md`). Severity ≠ confidence. For security findings, also note dep class (runtime/dev/transitive/non-exploitable); never raise action priority above evidence level.
4. Update `loops/STATE.md`: add new Open items, set "Last updated", record last-green SHA if tests pass.
5. Append one row to `loops/loop-run-log.md` (Date, loop=daily-triage, autonomy=L1, outcome, findings count, "report only", ~tokens, notes).
6. Stay within ~30k tokens (`loops/loop-budget.md`); if exceeding, write a partial report and stop.

Output a short triage summary to the user. One pass — do not iterate.
