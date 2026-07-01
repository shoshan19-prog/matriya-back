# MBM Stage C.10 — Prediction Calibration Engine

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

C.3 values experiments and C.4 plans them — but both only ever emit a
**prediction**: `predictedDeltaMRI`, with `observedDeltaMRI = null` and
`calibrationError = null`. Without C.10 the planner can look clever while staying
**uncalibrated**. C.10 closes the loop:

```
Prediction → experiment result → Observed ΔMRI → Calibration Error → the model learns
```

Harness: `npm run test:mbm-calibration` (wired into `test:unit`). Logic:
`scripts/mbm-calibration.mjs` — `calibrate(records)`.

## Scope — measurement only

C.10 **does not change any decision and does not select experiments.** Its single
job is to measure how trustworthy C.3/C.4's forecasts are:

- is the model **optimistic** (predicts more gain than it actually gets)?
- **pessimistic**?
- **well-calibrated**?
- on which **experiment types** and which **uncertainty components** is it wrong?

That is the prerequisite for a Research Readiness Index (C.12) and for trusting
the planner against real TGA/DSC data — neither of which we do yet.

```
input (per experiment):  { predictedDeltaMRI, experimentType, targetTransition, uncertaintyComponent }
after the result:        observedDeltaMRI
output:                  calibrationError = observed − predicted
                         bias by experimentType
                         bias by uncertaintyComponent
                         calibrationScore
```

## Sign convention

`calibrationError = observed − predicted`:

- `error < 0` → predicted **more** gain than observed → **optimistic**
- `error > 0` → observed **more** gain than predicted → **pessimistic**
- `|error| ≤ ε` → **well-calibrated**

Bias is the mean signed error within a group (by type, by component); the overall
bias is the mean signed error across all records.

`calibrationScore = clamp01(1 − MAE / norm)`, where `MAE` is the mean absolute
error and `norm` is the mean of `max(|predicted|, |observed|)` per record — so a
0.02 miss on a 0.02 prediction scores as *wrong*, not *almost perfect*. `1` means
forecasts match reality; `0` means wildly off. Heuristic, documented.

## Worked example (illustrative outcomes)

Predictions come from C.3 across both APP routes. The **observations** come from an
illustrative outcome model (`simulateObserved`, clearly flagged — see below):
Measurements return weaker than the corroboration-case forecast, Validations
corroborate.

```
n=6  overall: OPTIMISTIC  calibrationScore=0.42  (meanSignedError=-0.066)

  instrument:app_xl2 (TGA)  pred +0.246  obs +0.155  err -0.091  [Measurement/modelGap]
  observe:app_xl2           pred +0.094  obs +0.000  err -0.094  [Measurement/weakLink]
  instrument:app_xl1 (TGA)  pred +0.043  obs +0.014  err -0.028  [Measurement/evidence]
  instrument:app_ppa1 (TGA) pred +0.136  obs +0.045  err -0.091  [Measurement/evidence]
  instrument:app_ppa2 (TGA) pred +0.136  obs +0.045  err -0.091  [Measurement/evidence]
  validate:app_ppa1         pred +0.023  obs +0.023  err +0.000  [Validation/modelGap]

  by experiment type:    Measurement optimistic (meanErr -0.079) · Validation well-calibrated
  by uncertainty comp.:  modelGap / weakLink / evidence all optimistic
```

The engine correctly reports: **the planner is optimistic about Measurement
experiments** (they under-deliver vs. the corroboration-case forecast) while its
**Validation** forecasts are on the money. This is exactly the signal that, later,
lets C.5 Historical Learning discount over-optimistic predictions per type —
without C.10 touching any decision itself.

## How "observed" is produced here — honestly flagged

There is no ingestion yet, so `simulateObserved` stands in for lab results. It
**realises** each experiment on the model and reads the *actual* ΔMRI, so
`observed` genuinely differs from `predicted` (which assumed full corroboration):

- `corroborated` → the full intended effect (`observed ≈ predicted`).
- `partial` → a weaker result (e.g. an instrument that promotes status but yields
  only literature-tier evidence, not tier-1).
- `refuted` → no confirmation, no gain (`observed ≈ 0` → large optimistic error).

The engine's *logic* is what the suite tests — the fixture outcomes are
illustrative and replaced by real results at ingestion. Two tests guard this: a
**bite test** (if everything corroborates, error→0, score→1, well-calibrated) and
a **purity test** (`calibrate()` is deterministic and side-effect-free).

## Honest limits

- **Illustrative observations.** Until ingestion, `observed` is simulated;
  `calibrate()` itself is real and unchanged when fed real pairs.
- **Small-sample.** Bias by type/component is a mean over few records; it becomes
  meaningful as history accumulates (this is what C.5 will consume).
- **calibrationScore is a heuristic** normalisation, tunable — a summary metric,
  never a decision gate (same discipline as MRI).
- **Corroboration-case predictions.** The optimism measured here is partly *by
  construction*: C.3/C.4 predict the best case. That is the point — C.10 quantifies
  exactly how much reality falls short, per type and component.

## Stage C roadmap

C.1 ✅ · C.2 ✅ · C.3 ✅ · C.4 ✅ · **C.10 Prediction Calibration ✅** · C.5
Historical Learning (consume C.10's biases to correct future forecasts) · C.12
Research Readiness Index (next maturity gauge, once calibration has history) · C.6
Reliability-Gated Decision Hand-off · C.7 Uncertainty Budget Burndown · C.8
Knowledge Tension Map · C.9 Explicit Epistemic State · C.11 Mechanism Consensus ·
C.13 Contradiction Memory · C.14 Evidence Aging · C.15 Discovery Opportunity Map.

The loop C.3/C.4 opened is now closed:

```
C.4  predicted
C.10 observed + calibrated
```

RRI and real TGA/DSC ingestion come after calibration has something to measure.
