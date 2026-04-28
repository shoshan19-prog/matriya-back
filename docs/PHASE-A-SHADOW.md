# Phase A — Research Engine activation (shadow mode)

This document covers the changes shipped on branch
`research-engine-phase-a-shadow`. **Shadow mode only**: the kernel computes
what it would decide; it does **not** block answers. No user-facing response
shape changes.

## What changed (one-liners)

1. **`research_loop_runs.evidence JSONB`** — column added; populated with the
   source chunks returned to the client. Migration:
   `sql/add_research_loop_runs_evidence.sql`.
2. **`decision_audit_log` writes from `/ask-matriya`** — every call ends with
   one shadow audit row tagged `stage='ask_matriya'`.
3. **Kernel-v16 verdict** — computed for every `/api/research/run` and
   `/ask-matriya` call; stored under
   `decision_audit_log.details.shadow_decision`. Never blocks.

## Feature flags

| Env var                         | Effect                                                                                  | Default                  |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `MATRIYA_PERSIST_EVIDENCE`      | Save `research_loop_runs.evidence` JSON                                                 | ON outside `production`  |
| `MATRIYA_DECISION_AUDIT`        | Insert rows into `decision_audit_log` from `/ask-matriya` and `/api/research/run`       | ON outside `production`  |
| `MATRIYA_KERNEL_SHADOW`         | Compute kernel-v16 verdict and merge into `details.shadow_decision`                     | ON outside `production`  |

Set any flag explicitly to `true` / `1` to force on, or `false` / `0` to force
off, regardless of `NODE_ENV`.

## DB migration

Apply once on each environment that does not yet have the column:

```sql
\i sql/add_research_loop_runs_evidence.sql
```

Rollback:

```sql
ALTER TABLE research_loop_runs DROP COLUMN IF EXISTS evidence;
```

The `decision_audit_log` table already exists in `supabase_setup_complete.sql`
(Step 11c–11d) — no migration needed for the audit writes.

## Acceptance tests (run against a dev server)

```bash
# A. Document question — should still answer normally.
curl -sS -X POST "$BASE/ask-matriya" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"מה כתוב במסמך?","filenames":["sample.pdf"]}' | jq .

# B. No-data question — should still return STOP / insufficient evidence.
curl -sS -X POST "$BASE/api/research/run" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"שאלה ללא קשר","stage":"K","generate_answer":true}' | jq .

# C. Lab expansion query — expect existing answer (e.g. 18.5).
curl -sS -X POST "$BASE/ask-matriya" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"What is the expansion ratio?","filenames":["lab.xlsx"]}' | jq .

# D. Verify research_loop_runs.evidence is populated.
psql "$POSTGRES_URL" -c \
  "SELECT id, jsonb_array_length(COALESCE(evidence, '[]'::jsonb)) AS n_sources \
   FROM research_loop_runs ORDER BY created_at DESC LIMIT 3;"

# E. Verify decision_audit_log row per call.
psql "$POSTGRES_URL" -c \
  "SELECT id, stage, decision, response_type, basis_count, \
          details->'shadow_decision'->>'decision' AS shadow_decision \
   FROM decision_audit_log ORDER BY id DESC LIMIT 5;"

# F. Confirm shadow does not block: response payload is byte-identical to
#    pre-shadow baseline. Compare with --raw-output in jq if needed.
```

## Rollback

1. Set the three flags to `false` in the environment and restart.
2. Optional: drop the new column with the SQL above.
3. Code rollback: revert the merge of branch `research-engine-phase-a-shadow`.

## Files touched

- `sql/add_research_loop_runs_evidence.sql` (new)
- `lib/researchEngineFlags.js` (new)
- `lib/shadowKernel.js` (new)
- `lib/askMatriyaShadowAudit.js` (new)
- `database.js` — added `evidence` field to `ResearchLoopRun` model
- `researchLoop.js` — `saveRun` now accepts and stores `evidence`
- `server.js` — imports flags + helpers; `logDecisionAudit` merges
  `shadow_decision` into details; `/ask-matriya` registers a `res.on('finish')`
  hook that writes one shadow audit row per call.
- `env_example.txt` — documented the three flags
- `docs/PHASE-A-SHADOW.md` (this file)
