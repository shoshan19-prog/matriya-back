# MBM Ontology Validation Suite v1.0 — a falsification test

**Status: standard + runnable harness (docs + test, no runtime engine).**

Not *"does the ontology work on another example?"* but **"what would falsify
it?"** — the FSCTM stance. You do not confirm a world model by adding examples;
you try to break it. If it survives *without structural change*, it is general.

Harness: [`../../scripts/mbm-ontology-stress-test.mjs`](../../scripts/mbm-ontology-stress-test.mjs)
(`npm run test:mbm-stress`). Fixtures:
[`mbm-stress-fixtures.json`](./mbm-stress-fixtures.json).

## What the test throws at the ontology

- **5 driver families** (the generalisation criterion): Thermal (epoxy),
  Hydrochemical (silane), Mechanical (concrete), Photochemical (acrylic),
  Electrochemical (steel).
- **Coupled drivers** — up to 3 at once (steel stress-corrosion-cracking =
  stress + humidity + chemical). Real failures come from combinations.
- **Unknown transition** — `State A → ???` must produce a **Knowledge Gap**, not
  an invented answer.
- **Impossible transition** — `glass + uv → melting`, or hydrolysis in a dry
  atmosphere: the model must say *no known mechanism*.
- **All 7 Transition Statuses** — observed / replicated / mechanism_supported /
  predicted / hypothesized / unknown / impossible.
- **5 Invariants** — conservation of mass, entropy monotonicity, causality,
  equivalence, continuity — which every transition must respect or declare an
  exception for.

## The honest result: v1.0 did NOT survive

The test **falsified ontology v1.0**. Seven structural things broke — and each
break drove a concrete evolution to **v1.1**:

| What broke in v1.0 | Fix in v1.1 |
|--------------------|-------------|
| single `driver` can't express **coupled** drivers | `drivers: []` (1..N) |
| binary `isHypothesis` can't express 7 statuses | `status` enum (7) |
| `toState` was required — can't say `A → ???` | nullable `toState` + auto `knowledgeGap` |
| no way to state an **impossible** transition | `status: impossible` + `impossibleReason` |
| the 4-category driver taxonomy had no home for `time` | added a 5th category, `temporal` |
| no **invariants** and no exceptions | 5 invariants + `invariantExceptions[]` |
| no uncertainty measure | per-transition `entropy` + State Space Coverage |

This is the point of a falsification test: it found the gaps a confirming example
never would. **v1.0 was not a general model; v1.1, so far, is.**

## The 8 survival dimensions — v1.1 result (all pass)

| # | Dimension | Criterion | v1.1 |
|--:|-----------|-----------|------|
| — | Structural validity | 22 states / 17 transitions valid | ✅ |
| 1 | Driver Taxonomy | each driver in exactly one category | ✅ (temporal added) |
| 2 | Multi-Driver | ≥2 coupled drivers expressible | ✅ (7 coupled, max 3) |
| 3 | Reversibility | present on every transition | ✅ |
| 4 | Unknown Handling | unknown ⇒ null toState + Gap{cost,impact,priority} | ✅ |
| 5 | Transition Status | all 7 represented | ✅ |
| 6 | Invariant Testing | no un-excepted violation across **all 5** invariants | ✅ |
| 7 | State Space Coverage | ≥ 30% of material×category cells | ✅ (48%) |
| 8 | Transition Entropy | average < 0.5 | ✅ (0.241) |

## Why it matters

Because the model now handles coupled drivers, the unknown, the impossible, and
enforces physical invariants, it stops being "an ontology that fits an example"
and becomes **computational materials mechanics**:
- **Simulation** — predict, not guess (with entropy as an uncertainty cloud).
- **Design** — the coverage map *shows what is missing* (gap-driven experiment
  planning).
- **Learning** — every experiment lowers entropy and raises coverage.

The name follows the substance: it does not model a *material*, it models
**behaviour** — Matter + Energy + Environment + Time — hence **Material Behavior
Model (MBM)**.

## Invariant Suite — all 5 now auto-checked

`npm run test:mbm-invariants` (also run inside D6) auto-verifies every invariant,
with a documented operational definition for each. Each check was **verified to
bite** by a negative test (tamper a fixture → the check fires):

| Invariant | Operational check | Negative test |
|-----------|-------------------|---------------|
| conservation_of_mass | `mass ↓/↑` in resultingProperties ⇒ must declare an exception | remove exception → CAUGHT |
| entropy_monotonicity | spontaneous (irreversible + observed/replicated/mechanism_supported) **ordering** (network/crystallisation/`entropy ↓`) ⇒ must account for energy or declare an exception | remove exception → CAUGHT |
| causality | the irreversible-edge graph must be **acyclic** (reversible/conditional edges excluded) | add an irreversible cycle → CAUGHT; a reversible back-edge is correctly ignored |
| equivalence | no two state ids share a `(material, state)` identity; identity-preserving transitions must be reversible | add a duplicate identity → CAUGHT |
| continuity | a real transition must be a phase change **or** carry a mechanism **or** declare an exception (no unexplained jump) | null a mechanism → CAUGHT |

The model now rejects non-physical transition paths *before* any real data is
ingested — the instrument is calibrated before the measurement.

## Invariant Coverage — depth of the check, not just pass/fail

Passing is not enough: a model where every invariant passes but 4 of 5 were
exercised on a single transition is **blind to its own gaps**. `computeCoverage()`
(run inside `npm run test:mbm-invariants`) derives, per transition, a
**CoverageVector** — which invariants it *non-vacuously exercised* — and reports
how many transitions stress each invariant:

```
Invariant Coverage (over 14 real transitions; gate = >= 3 exercising transitions each)
  ✅ conservation_of_mass    29%  (4/14)
  ✅ entropy_monotonicity    21%  (3/14)
  ✅ causality               79%  (11/14)
  ✅ equivalence            100%  (14/14)
  ✅ continuity             100%  (14/14)
```

**Methodological finding — the gate is a count floor, not "80% of all".** The
first measurement showed mass 14% (2 transitions) and entropy 7% (1) — genuinely
under-tested. But a uniform *"≥80% of all transitions"* bar is **physically
impossible** for these invariants: most transitions legitimately do not change
mass or create order, so mass could never reach 80%. The meaningful acceptance
criterion is a **diversity floor — each invariant must be exercised on ≥ 3
distinct transitions** (`MIN_EXERCISED`), which the suite enforces (exit non-zero
below it, verified to bite by a negative test).

To reach the floor, two *physically real* transitions were enriched (not padded):
steel oxidation (`electro_2`) gains mass and forms a **crystalline oxide**;
concrete carbonation (`mech_3`) absorbs CO₂ mass and **crystallises** CaCO₃ — each
with its honest conservation/entropy exception. That lifted mass to 4 and entropy
to 3. This is the coverage metric doing its job: it forced genuinely new physics
into the test set rather than more of the same.

*(Note: this "Invariant Coverage" is distinct from survival-dimension D7 "State
Space Coverage", which measures material×driver-category cells.)*

## Honest limits

- The checks are **heuristic by design** (structural physical consistency, not
  full thermodynamics): e.g. entropy is checked as "spontaneous ordering must
  account for energy or declare an exception", not by computing ΔS. Each
  operational definition is stated above and in `scripts/mbm-invariants.mjs`.
- Fixtures are **illustrative** (placeholder provenance); the suite tests the
  *representation's* generality, not sourced chemistry. Real evidence comes via
  ingestion (step b).
- Coverage is measured over the 5 test families; a production State Space defines
  its own space.
