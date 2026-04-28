-- Phase A (shadow): persist the evidence sources used for each research-loop run.
-- Additive only. Default '[]' so existing rows remain valid.
-- Rollback: ALTER TABLE research_loop_runs DROP COLUMN IF EXISTS evidence;

ALTER TABLE research_loop_runs
  ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN research_loop_runs.evidence IS
  'Phase A: source chunks (file, distance, snippet) used by the run. Empty array when no RAG context was retrieved.';
