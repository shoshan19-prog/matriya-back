# P0 First Flight — Controlled First Exposure (design + dry-run)

**Status: DRY-RUN / DESIGN. No ingestion, no fetch, no autonomous decision, no
invented chemistry.** The first flight runs a single **illustrative** APP/PER/MEL
dataset through the whole Stage-B/C machinery to prove the pipeline **listens**
correctly. The dataset is flagged illustrative — real curves enter only through the
ingestion gates (G1–G6).

> "We are not testing whether the model is right — we are testing whether we know
> how to listen to it."

Harness: `npm run test:first-flight`. Logic: `scripts/first-flight.mjs`
(`runFirstFlight`, `driftMonitor`). Dataset: `dataset-001-app-per-mel.json`.

## The five first-flight principles (implemented)

1. **Live-attenuated data.** A well-known system (APP/PER/MEL). The goal is *does
   the pipe work?*, not new facts — a divergence from the literature would mean a
   pipeline bug, not new physics.
2. **Surveillance mode.** Every deviation is triaged against three references, in
   order: **assumptions** (context) → **invariants** (physics) → **failure corpus**
   (adversarial). *Iron rule:* a deviation explained by a broken assumption
   (e.g. a different heating rate) is reported as **`context_changed`**, never as
   "new material". In Dataset #001, `o5` (300 °C, appears only at 5 °C/min) is
   correctly labelled context; `o4` (350 °C endotherm) survives triage as a genuine
   `candidate_new` and is cross-checked against the corpus (`fail_app_char_oxidation`).
3. **Co-pilot protocol.** Every flight emits the machine's recommendation **and**
   the targeted questions of what it doesn't know (e.g. *"no observation near
   280 °C for the crosslinking route — was this step present under these
   conditions?"*). The tower doesn't just approve — it flies along.
4. **Observations ≠ hypotheses.** Raw observations are kept strictly separate from
   ranked hypotheses (paths + MRI + epistemic state). A single flight **promotes
   nothing** — `Hypothesized → Corroborated` needs ≥3 independent datasets.
5. **Post-flight report.** The output answers *did we learn?*, not *did we
   succeed?*: prediction accuracy, surprises, adversarial (corpus) flags, and
   **proposed** (never applied) prior updates — each gated behind human sign-off.

### Dataset #001 result (illustrative)

- Prediction accuracy **75%** (3/4 expected steps matched; crosslink @280 °C not
  observed → parameter-adjustment proposal).
- **1 surprise** (350 °C endotherm) → proposed new path, adversarially linked to a
  char-oxidation failure case.
- **1 context** (300 °C, assumption-broken) → not counted as new material.
- Promotion applied: **false**. All model updates: **proposed**, with provenance.

## Five efficiency/development ideas of our own (added)

1. **Golden-curve replay.** Each verified flight becomes a deterministic golden
   test; re-running it on every model change guards against silent regressions as
   the MBM evolves. (Implemented as the flight's purity/determinism check.)
2. **Cross-instrument corroboration.** Promotion to `Corroborated` requires
   agreement across **≥2 distinct techniques** (TGA + DSC + FTIR), not 3 repeats of
   one — triangulation at the observation level (complements C.11). Encoded in the
   promotion rule.
3. **Assumption-sensitivity.** Conclusions that hang on a context-dependent
   observation are flagged **assumption-fragile** (Dataset #001 flags `o5`), turning
   the assumption tracker from a gate into a quantitative sensitivity.
4. **Drift monitor.** `driftMonitor(accuracies, budget)` accumulates prediction
   error across flights; when cumulative error exceeds the budget it raises a
   *recalibration-due* flag (a flag, not an autonomous action) — ties C.10/C.5 to
   C.7 Uncertainty Budget Burndown once real data flows.
5. **Two-way provenance ledger.** Every proposed model update records *which
   observation* caused it (`causedBy`), and (at ingestion) every observation records
   which priors it moved — so any future contradiction is traceable and
   reversible (ties to Contradiction Memory + Evidence Aging + ingestion rollback).

## What the harness proves (bite tests)

- observations kept separate from hypotheses; nothing promoted from one flight;
- accuracy computed (75%);
- the assumption-broken deviation is `context_changed`, **not** a surprise (iron rule);
- the planted 350 °C surprise **is** detected and corpus-cross-checked;
- co-pilot emits targeted questions; every update is a **proposal** with provenance
  and a human gate; assumption-fragile conclusions surfaced; drift monitor fires
  only over budget; the whole flight is a deterministic golden replay.

## Boundaries honoured

❌ no ingestion · ❌ no fetch · ❌ no autonomous decision (report proposes, humans
dispose) · ❌ no invented chemistry (illustrative dataset, flagged) · MRI/RRI are
gauges. The first *real* flight = run this harness on a human-verified dataset that
has passed G1–G6.
