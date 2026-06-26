# loop-run-log.md — Execution history

> Append-only. Every loop run adds one row. Never edit or delete past rows — this is
> the audit trail. If a run capped its coverage (sampled, skipped, timed out), say so
> in **Notes** so a clean-looking row never hides incomplete work.

| Date | Loop | Autonomy | Outcome | Findings | Actions | ~Tokens | Notes |
|------|------|----------|---------|----------|---------|---------|-------|
| _example_ | daily-triage | L1 | ok | 2 | report only | ~8k | template row — delete on first real run |
