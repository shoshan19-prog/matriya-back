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

## Golden Suite — regression + anti-overfit (option A)

Before touching real data, a short golden suite runs the **same** harness over
three illustrative chemistries to prove the pipeline is not fitted to APP:
`scripts/golden-suite.mjs` (`test:golden-suite`) over datasets #001 APP/PER/MEL,
#002 silicate, #003 cementitious.

| Dataset | Accuracy | Hypotheses | New region | Surprise | Context |
|---------|---------:|-----------:|:----------:|:--------:|:-------:|
| APP/PER/MEL | 75% | 3 | no | 1 (350 °C) | o5 |
| silicate | 67% | 0 | **yes** | 1 | si4 |
| cementitious | 75% | 0 | **yes** | 1 | ce5 |

**Anti-overfit result:** the same pipe generates ranked hypotheses **only where
the MBM actually models the system** (APP's thermal path) and, for systems it does
not model (silicate; cementitious thermal decomposition), reports an honest **NEW
REGION** — it fabricates no APP-like route — while still separating context from
surprise and proposing (never deciding) in every case. Every flight is a
deterministic golden replay, and the suite's mean prediction error (0.28) sits
within the drift budget — the healthy baseline that guards against silent
behaviour drift as the MBM evolves.

(Hypothesis generation for *modelled* non-APP systems is independently covered by
`test:mbm-altpaths`, which ranks paths across epoxy/silane/concrete/steel.)

## P0.1 — Gated First Flight (one dataset through G1–G6, then fly)

`scripts/p0-1-gated-flight.mjs` (`test:p0-1-gated`) wires the flight to the
ingestion gates: **the harness runs only if the dataset's ingestion request clears
all six gates** (G1 human submitter · G2 provenance confirmed · G3 evidence graded
· G4 every claim anchored · G5 MBM mapping confirmed · G6 dual sign-off). You
cannot fly ungated.

- Request `ingest-request-001-app.json` grounds the APP/PER/MEL flight in **real
  public standards** (EN 13381-8 / ISO 834) with citation anchors and dual
  sign-off → clears G1–G6 → **flight permitted** (accuracy 75%, top route
  `app:solid → PPA → char`, surprise @350 °C, promotion still not applied).
- **Bite tests:** drop the mechanism's citation anchor → G4 fails →
  **flight blocked** (you cannot fly on invented chemistry); single reviewer → G6
  fails → blocked. The gate genuinely guards the flight.

**Honesty boundary (unchanged):** provenance is grounded in real standards, but the
numeric TGA/DSC values remain **reference-class pending real instrument data**, and
the request's reviewer roles are illustrative role-holders demonstrating the
mechanism — not a claim that named humans reviewed real spans. A *true* P0.1 swaps
in a human-verified request + a real measured curve; the flow, gates, and report
shown here are exactly what it runs.

## Boundaries honoured

❌ no ingestion of real measured curves · ❌ no fetch · ❌ no autonomous decision
(report proposes, humans dispose) · ❌ no invented chemistry (illustrative datasets
flagged; provenance grounded in real standards) · MRI/RRI are gauges. The gated
flight is the safe last step before genuinely measured data.
