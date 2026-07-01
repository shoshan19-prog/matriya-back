# MBM Stage C.4 — Experiment Planner

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

C.4's job is **not** "pick the best experiment." It is **build an optimal research
portfolio under constraints** — a budget of cost and time. It consumes C.3's
valued candidates and returns a *plan*: which experiments, in what order, the true
expected knowledge gain, and — crucially — **which knowledge gaps remain after the
whole plan runs**.

> Diagnosis (C.2) → Valuation (C.3) → **Planning (C.4)**.
> C.4 still does not decide to run anything. It recommends a plan; the go/no-go
> stays with the human (Decision Boundary).

Harness: `npm run test:mbm-planner` (wired into `test:unit`). Logic:
`scripts/mbm-experiment-planner.mjs` — `planExperiments(doc, ids, {maxCost, maxTime})`.

## The one idea that makes this more than "sort by ΔMRI, take the top N"

**ΔMRI is not additive.** The planner never sums standalone gains — it
re-simulates the model with the already-selected experiments applied and takes
each candidate's *marginal* gain in that context. Non-additivity runs **both
ways**, which is exactly why summation is wrong:

- **Sub-additive** when two experiments push the *same* transition (observe then
  instrument on one step — the second reaches a state the first partly reached).
- **Super-additive** when they fix *different* links: MRI is a weakest-link
  product, so raising link A *and* link B multiplies through — the pair is worth
  **more** than the sum of each alone.

In the worked example below the naive sum is **0.29** but the true portfolio gain
is **0.47** (super-additive). A planner that summed standalone C.3 values would
misprice the program. So C.4 uses a **submodular greedy under budget** (marginal
ΔMRI ÷ cost×time), a documented approximation to the NP-hard budgeted knapsack,
followed by a **prune pass** that drops any experiment whose contribution *given
the others* is ~0 (efficiency-greedy can otherwise fund a partially-redundant
experiment).

## Experiment type is part of the model (review point)

An experiment is not just a measurement. Each candidate carries an
`experimentType` from a taxonomy:

| Type | Meaning | Generated in C.3/C.4 today |
|------|---------|-----------------------------|
| **Measurement** | measure a state / confirm a transition (observe, TGA/DSC/FTIR) | ✅ auto-generated |
| **Validation** | replicate an observed result (`observed → replicated`) | ✅ auto-generated |
| **Perturbation** | change a driver to test causality (e.g. heating rate) | recognised; needs driver-level modelling |
| **Comparison** | discriminate between competing mechanisms (e.g. APP grades) | recognised; needs cross-path modelling |
| **StressTest** | probe the boundary of validity | recognised; needs boundary modelling |

The two types that map cleanly to a single-transition confidence change are
auto-generated and simulated today; the other three live in the taxonomy and are
generated once the model carries the driver-level / cross-path structure they
need. Nothing is silently dropped — the harness reports the taxonomy explicitly.

## Information Gain is a prediction, not a fact (review point)

Every planned experiment is a **forecast**: it carries `predictedDeltaMRI`, with
`observedDeltaMRI` and `calibrationError` left `null`, ready for the **Prediction
Calibration Engine** (roadmap) to fill *after* the experiment actually runs. That
is the seed of real Meta-Learning — the model learning whether its own forecasts
are optimistic, pessimistic, or well-calibrated. C.4 produces the predictions; a
later stage closes the loop against reality.

## Worked example — crosslink route (`app:solid → crosslinked → char`)

```
TIGHT budget (cost≤2, time≤3) — room for one experiment
  1. [Measurement] observe:app_xl2 — status → observed   (predicted ΔMRI +0.094)
  spent cost=1 time=2 → MRI 0.057 → 0.151 (closes 10% of the gap)
  remaining: dominant=evidence; no-instrument=[app_xl1, app_xl2]

LOOSE budget (cost≤10, time≤20) — fund the program
  1. [Measurement] instrument:app_xl2 (TGA) — tier-1 + status → observed  (predicted ΔMRI +0.246)
  2. [Measurement] instrument:app_xl1 (TGA) — tier-1                       (predicted ΔMRI +0.227)
  spent cost=4 time=6 → MRI 0.057 → 0.529 (closes 50% of the gap)
  remaining: dominant=modelGap; unvalidated=[none]; no-instrument=[none]
  [check] naive Σ standalone ΔMRI = 0.288  vs  true portfolio ΔMRI = 0.473  → non-additive
```

Under a tight budget the planner buys the single most efficient experiment (the
cheap observation of the hypothesized step). Given room to fund the program it
selects the two instrument experiments and **prunes the now-redundant observe**
(TGA already promotes the step), reaching the same end-state at lower cost. Both
plans report exactly what is still open afterwards.

## What the plan returns

- `portfolio` — ordered experiments, each with `experimentType`, cost/time and a
  `predictedDeltaMRI` (+ null `observedDeltaMRI`/`calibrationError` for calibration).
- `expected` — the **true** portfolio `deltaMRI` (by re-simulation), `mriAfter`,
  `knowledgeClosed` (fraction of the MRI shortfall closed), and the count of
  competing mechanisms before/after.
- `remainingGaps` — the dominant uncertainty that survives, the steps still
  unvalidated, and the steps still lacking instrument evidence. A plan is honest
  about what it does **not** resolve.

## Honest limits

- **Greedy ≈, not =, optimal.** Budgeted portfolio selection is NP-hard; greedy
  by marginal efficiency + a prune pass is a documented heuristic, not a
  guaranteed optimum.
- **Sequential budget.** Time is summed (experiments run one after another); a
  parallel-lab model would use makespan instead. Documented, tunable.
- **Corroboration-case predictions.** `predictedDeltaMRI` inherits C.3's
  assumption that each experiment yields its intended effect; a refuting result is
  Surprise Analysis (roadmap). This is why the value is a *prediction*, to be
  reconciled with the observed result by the Calibration Engine.
- Illustrative cost/time and heuristic confidence model, like all of Stage B/C.

## Stage C roadmap

C.1 Alternative Path Generator ✅ · C.2 Uncertainty Attribution ✅ · C.3
Information Gain Engine ✅ · **C.4 Experiment Planner ✅** · C.5 Historical
Learning (update source-reliability from realised vs. predicted gain) · C.6
Reliability-Gated Decision Hand-off · C.7 Uncertainty Budget Burndown · C.8
Knowledge Tension Map · C.9 Explicit Epistemic State.

### Six further integrating ideas (from review)

- **C.10 — Prediction Calibration Engine ✅** (built — see
  `MBM-Stage-C-PredictionCalibration.md`). After each experiment: `Expected ΔMRI →
  Observed ΔMRI → Calibration Error`, rolled up into a **calibrationScore** plus
  bias by experiment type and by uncertainty component. Turns the system from an
  *estimator* into a *learner* — it discovers whether it is systematically
  optimistic or pessimistic. Consumes the `predicted/observed/calibrationError`
  slots C.4 emits; measurement only (no decisions); feeds C.5.
- **C.11 — Mechanism Consensus (triangulation).** C.1 ranks paths individually.
  This adds: *how many independent routes converge on the same intermediate?* If
  three independent paths pass through one intermediate, the **mechanism** gains
  confidence even when no single path is strong — scientific triangulation as a
  distinct reliability layer.
- **C.12 — Research Readiness Index (RRI).** MRI describes a *path*; RRI describes
  the *whole model* — combining coverage, calibration, epistemic-state
  distribution, competing mechanisms, information gaps and confidence spread into
  one question: **is the model mature enough to receive real TGA/DSC data?** Not a
  decision gate — a maturity gauge for the scientific instrument itself.
- **C.13 — Contradiction Memory.** Never delete a contradiction; store it as a
  knowledge object (`prediction → experiment → contradiction`). Then measure which
  mechanisms produce the most contradictions, which assumptions break repeatedly,
  and which regions of the model are least stable — turning refutations into an
  asset, not a failure.
- **C.14 — Evidence Aging.** Not all evidence stays reliable: tag each with
  `freshness`, `replicationCount`, `lastValidation`. Lets the model distinguish
  strong evidence from stale evidence that needs re-validation — critical in
  materials science where old equipment and unreproduced results abound.
- **C.15 — Discovery Opportunity Map.** Beyond "what do we know?" — *where is the
  highest chance to discover something new?* Combines competing mechanisms, low
  coverage, high uncertainty, high information gain and high industrial value into
  **Top Discovery Opportunities**: if you have budget for one experiment, where is
  the greatest chance of real ΔKnowledge. Moves the system from managing knowledge
  to managing *discovery potential*.
```
