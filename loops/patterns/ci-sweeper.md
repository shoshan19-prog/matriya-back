# Pattern: CI Sweeper

**Cadence:** on CI failure (or every 5–15 min while red) · **Autonomy:** L2 (cautious) · **Cost:** Very high

## Goal (the recursive purpose)

When CI goes red, diagnose and fix it, looping until **CI is green** — then report.

## Stop condition

- ✅ CI passes → report the green status and stop (the report **is** the deliverable).
- 🛑 After **3 fix attempts** with no progress → stop, write the diagnosis to
  `STATE.md`, and ask the human. Do not loop forever.
- 🛑 Failure is real but out of scope → report where you're stuck.

## What it does each round

1. Pull the failing job logs (GitHub MCP `get_job_logs` / `actions_get`).
2. Reproduce locally where possible: `npm test`, `npm run test:integration`.
3. Form a hypothesis → make the **smallest** fix → re-run the failing check.
4. If green, push and report. If still red, increment attempt counter and re-diagnose
   (a different hypothesis — not the same fix again).
5. Append every attempt to `loop-run-log.md` with the token cost.

## Guardrails

- L2: pushes fixes to the working branch; **no auto-merge** to `main`.
- Hard cap: **3 attempts per failure**, ~80k tokens/run (see `loop-budget.md`).
- Never make CI green by deleting/skipping/weakening tests — fix the underlying bug.
- Distinguish flaky from real: if a re-run alone goes green, log it as flaky in
  `STATE.md` rather than "fixing" nothing.

## Run it

```
/loop-ci-sweeper <run-id or branch>
```
Triggered automatically by `.github/workflows/ci.yml` on failure (see the `on:` block).

## Why "Very high" cost

Reading large CI logs + repeated full test runs per attempt is the most expensive
loop here. The 3-attempt cap and the token ceiling exist specifically to contain it.
