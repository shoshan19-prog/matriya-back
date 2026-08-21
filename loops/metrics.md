# metrics.md — Loop Engineering v1 stabilization data (matriya-back)

> **Data collection only.** During stabilization we record; we do not change behaviour
> based on these numbers until the Validation Report. Append events; recompute totals.
> Source of raw events: `loop-run-log.md`. Period start: **2026-06-26**.

## Metric definitions

| Metric | Definition |
|--------|------------|
| Loop runs | Count of loop executions (any loop) |
| Events | PR/CI/review events received |
| Automatic interventions | Fixes pushed by a loop (infra-only, per policy) |
| Human interventions | Actions a human had to take that the loop could not/was not allowed to |
| False positives | A finding raised that turned out not to be real/relevant |
| False negatives | A real problem the loop **failed** to detect |
| MTTD | Mean time from problem occurring to loop detecting it |
| MTTR | Mean time from detection to resolution |

## Running totals (recompute on each update)

| Metric | Value as of 2026-06-26 |
|--------|------------------------|
| Loop runs | 1 (daily-triage #1) |
| Events | 0 |
| Automatic interventions | 0 |
| Human interventions | 0 |
| False positives | 0 |
| False negatives | 0 |
| MTTD | n/a (no incidents yet) |
| MTTR | n/a (no incidents yet) |

## Event ledger (append one row per event)

| Date/UTC | Type | Detected by | Auto/Human | Detect→Resolve | FP/FN | Notes |
|----------|------|-------------|------------|----------------|-------|-------|
| _none yet_ | | | | | | |
