# MBM Stage C — Completion (C.5, C.8, C.9, C.12, C.13–C.15 + Report)

**Status: standard + runnable harnesses (docs + tests). No ingestion, no
autonomous decisions, no MRI/RRI used as a decision gate.** This closes Stage C:
the MBM is now an instrument that measures *what it knows, what it doesn't, what
to test next, and how ready it is to meet real TGA/DSC data.*

Every module below is a **pure measurement / recommendation / report** — it never
chooses to run an experiment, never ingests data, and never turns a score into an
automatic gate. Each ships with a self-consistency harness wired into `test:unit`,
and every check was verified to *bite* (negative/BITE tests where relevant).

## C.5 — Historical Learning (`mbm-learning.mjs`, `test:mbm-learning`)

Turns C.10's calibration bias into **correction factors** that shrink or grow a
*future* predicted ΔMRI — correcting **predictions only**, never decisions.

- Factor = `mean(observed)/mean(predicted)` per group; `<1` shrinks optimistic
  forecasts, `>1` grows pessimistic ones.
- Learned at several specificities, applied **most-specific-first**:
  `experimentType×targetTransition → experimentType×uncertaintyComponent →
  experimentType`. All keys are **type-aware** (a bare-transition factor would mix
  a Measurement and a Validation on the same transition and contaminate both).
- A context with no learned bias is left **uncorrected (factor 1.0)** — *not*
  nudged by a global factor. This conservative choice prevents one group's bias
  (Measurement optimism) leaking onto a well-calibrated group (Validation).
- Only groups with enough history (`MIN_SAMPLES`) earn their own factor.
- **Proof:** applying the learned corrections raises the calibrationScore
  (0.42 → 0.74 on the fixtures) and drives the biased type's signed error toward 0,
  while the well-calibrated group is left undisturbed.
- *Honest limit:* the demo learns and re-checks **in-sample**; true predictive
  validation needs held-out lab data (ingestion).

## C.8 — Knowledge Tension Map (`mbm-tension-map.mjs`, `test:mbm-tension`)

Lifts uncertainty from a path to the **whole model**. Each state is labelled
(priority order): `coverage_gap` (frontier / all-unvalidated) → `contradiction`
(a genuine invariant **violation** — *not* a declared exception like normal mass
loss, which is legitimate) → `tension` (≥2 competing outgoing mechanisms) →
`stable`. Reports counts, a `tensionIndex`, and hotspots.

- **Key correction over the naïve design:** declared invariant exceptions are
  legitimate physics, so they are *not* contradictions — labelling them so was
  noise. Contradiction is reserved for real violations, verified by a **BITE test**
  that injects a mass-creating transition and confirms it is flagged.

## C.9 — Epistemic State (`mbm-epistemic.mjs`, `test:mbm-epistemic`)

Tags each path with a **kind** of knowledge, derived from status + evidence tier +
invariant standing — **orthogonal to the MRI number**: `Refuted` (impossible /
invariant violation) · `Undecidable` (unknown step) · `Confirmed` (all validated +
instrument-tier throughout) · `Corroborated` (all validated & evidenced, not all
instrument-confirmed) · `Hypothesized` (a guess remains).

- **Orthogonality demonstrated:** the epoxy chain (MRI 0.076) and the PPA route
  (MRI 0.181) are *both* Corroborated despite different MRI; the crosslink route
  (MRI 0.057) is Hypothesized. Adding instrument evidence flips PPA to Confirmed.
  This is the layer that will change **discretely** when real data lands.

## C.12 — Research Readiness Index (`mbm-readiness.mjs`, `test:mbm-readiness`)

Combines five model-wide dimensions into one **maturity gauge** answering: *is the
MBM ready to receive real TGA/DSC?* — `coverage` (Stage A), `calibration` (C.10),
`epistemic` (C.9), `mechanism` (C.8 tension), `gaps` (validated+evidenced
fraction). Weighted (documented, tunable), calls out the weakest dimension.

- **Explicitly a gauge, not a gate.** RRI never auto-approves ingestion; a human
  decides. Unmeasured calibration scores 0 and changes the recommendation to "run
  C.10 first" — you cannot trust forecasts you have not checked.
- On the fixtures: **RRI 0.74 → READY, weakest = calibration** (monotonicity
  verified: confirming paths with instrument evidence raises RRI, never lowers it).

## C.13 — Contradiction Memory (`mbm-contradiction-memory.mjs`, `test:mbm-contradiction`)

Keeps refutations as knowledge objects instead of deleting them. A contradiction =
a prediction of gain that the experiment refuted (`predicted > ε` and
`observed ≤ 0`). Memory **accumulates across rounds** and aggregates by transition,
mechanism (experiment type) and uncertainty component, surfacing the least-stable
regions. (Invariant-violation contradictions are the C.8 kind; this is the
prediction-vs-reality kind.)

## C.14 — Evidence Aging (`mbm-evidence-aging.mjs`, `test:mbm-aging`)

Re-weights an evidence item's tier by `freshness` (half-life decay with age),
`replicationCount` (restores trust) and `lastValidation` (recency). **Dormant by
design:** it changes no schema and no fixture — it activates at ingestion when
real evidence carries provenance dates. Undated evidence is neutral (unknown ≠
old); time is passed in via `nowYear` (the runtime has no wall clock). Report
only — it re-weights, never rejects.

## C.15 — Discovery Opportunity Map (`mbm-discovery.mjs`, `test:mbm-discovery`)

Inverts the question to *where is new knowledge most likely?* — ranking states by
competing mechanisms (C.8) + high uncertainty (Stage B) + low coverage +
**optional, caller-supplied** industrial value (never invented by the engine).
The top row is where one exploratory experiment has the best chance of real ΔK.

## Stage C Scientific Reasoning Report (`mbm-stage-c-report.mjs`, `test:mbm-stage-c-report`)

The capstone: one report that runs the whole loop over the model and prints, end
to end — **alternative paths · uncertainty attribution · information gain ·
experiment portfolio · calibration · learning correction · tension map · epistemic
states · RRI · remaining gaps & discovery opportunities.** Every number is sourced
from a Stage-C engine; the report only orchestrates and prints. It is a pure
function of `(model, query)` and makes no decision, performs no ingestion.

Example (fixtures, `app:solid → app:char`): the well-evidenced polyphosphoric-acid
route leads (pathMRI 0.40); its dominant uncertainty is `evidence`; the plan closes
~54% of the MRI gap; calibration reports the planner as optimistic on Measurement;
learning applies a ×0.48 correction to Measurement forecasts; the tension map flags
`app:solid` as a competing-mechanism branch point; the PPA and thermal paths are
Corroborated while crosslink is Hypothesized; **RRI 0.74 → READY, weakest =
calibration.**

## Boundaries honoured (per the mandate)

- ❌ no ingestion · ❌ no engine run on external data · ❌ no MRI/RRI as an
  automatic decision criterion · ❌ no new entity without a necessity test
  (every module reuses the existing graph/engines; Evidence Aging stays dormant to
  avoid a schema change) · ✅ everything is measurement / recommendation / report.

## Final Stage C roadmap

C.1 Alternative Paths ✅ · C.2 Uncertainty Attribution ✅ · C.3 Information Gain ✅
· C.4 Experiment Planner ✅ · C.5 Historical Learning ✅ · C.8 Knowledge Tension
Map ✅ · C.9 Epistemic State ✅ · C.10 Prediction Calibration ✅ · C.12 Research
Readiness Index ✅ · C.13 Contradiction Memory ✅ · C.14 Evidence Aging ✅ · C.15
Discovery Opportunity Map ✅ · **Stage C Scientific Reasoning Report ✅**.

Deferred (need cross-path/driver modelling or provenance data — natural
ingestion-era work): C.6 Reliability-Gated Decision Hand-off · C.7 Uncertainty
Budget Burndown · C.11 Mechanism Consensus (triangulation) · Surprise Analysis
(the refutation branch that C.10/C.13 already leave a hook for).

Stage C is complete as a scientific instrument: it measures what the model knows,
what it doesn't, what is worth testing, and how ready it is to meet real
TGA/DSC data — without making a single decision on the lab's behalf.
