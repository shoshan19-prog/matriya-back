---
name: eval-harness
description: Run MATRIYA answer-quality regression checks — fire a fixed question set at GET /search, classify each answer (grounded / insufficient / locked / error), compare to expectations and to the previous baseline to catch grounding regressions. Use when the user asks to evaluate answer quality, check for regressions, or validate retrieval/grounding after a change.
---

# Eval Harness

Unifies the spirit of the existing checks (`check:retrieval-threshold`, `check:answer-binding`, controlled-comparison) into one runnable report. Read-only against `/search`; does not change core logic.

## How it works
- Loads cases from `scripts/eval-cases.json` (each: `name`, `query`, `expect: grounded|insufficient`, optional `session_id`).
- Hits `GET /search?query=...&generate_answer=true&flow=document` per case.
- Classifies: `grounded` (HTTP 200 + answer + sources) · `insufficient` (HTTP 422 / INSUFFICIENT_EVIDENCE) · `locked` (gate violation) · `error`.
- Compares to `expect` (pass/fail) and to `scripts/eval-baseline.json` (drift → regression).

## How to run
Backend must be running; `BASE_URL` default `http://localhost:8000`.

```bash
npm run eval:harness                            # run + compare to baseline
node scripts/eval-harness.mjs --update-baseline # save current results as the new baseline
node scripts/eval-harness.mjs --cases my.json   # custom case file
node scripts/eval-harness.mjs --json            # raw JSON
```

Exit code: `0` all pass, no regressions · `2` failures or regressions · `1` run error (e.g. server down).

## Editing cases
Edit `scripts/eval-cases.json` to match real documents in the vault. Add a `grounded` case for every fact the system *should* answer, and an `insufficient` case for every out-of-scope question it *should* refuse. The baseline (`eval-baseline.json`) is git-ignored and machine-local; commit a curated cases file, not the baseline.
