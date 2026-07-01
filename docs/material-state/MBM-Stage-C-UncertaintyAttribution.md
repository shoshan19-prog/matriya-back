# MBM Stage C.2 — Uncertainty Attribution

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

C.1 answered *"which explanation is most reliable?"*. C.2 answers the next
question a scientist asks: **"my confidence is low — *why*, and *what do I do
about it?"*** Returning `MRI = 0.06` is a dead end. Decomposing that number into
named, actionable sources tells the lab **where to invest** to raise trust. This
is the bridge to C.3 (Information Gain) and C.4 (Experiment Planner): those
engines need a *typed* uncertainty to act on, not a scalar.

Harness: `npm run test:mbm-uncertainty` (wired into `test:unit`). Logic:
`scripts/mbm-uncertainty.mjs` — `attributeUncertainty(doc, ids)`. It reuses the
Stage-B confidence model and the Stage-A coverage model; it adds no new physics.

## The decomposition

A transition's confidence is `c_i = base(status) × tier(evidence)`. Its shortfall
`1 − c_i` factors **cleanly** into two independent, interpretable parts:

```
1 − c_i = (1 − base)        [Model Gap — the transition itself is not yet
                             observed/validated; status is predicted/hypothesized]
        + base · (1 − tier)  [Evidence — the transition is plausible but the
                             supporting source is weak or absent]
```

This is an exact identity per step (algebra, not a heuristic): a low `c_i`
because a step is a *guess* is a fundamentally different problem from a low `c_i`
because a *real* step *lacks instrument data* — and they have different fixes
(go observe vs. go measure). At the path level C.2 reports four sources:

| Source     | Definition                                       | Meaning                                   |
|------------|--------------------------------------------------|-------------------------------------------|
| `modelGap` | mean `(1 − base)` across steps                   | steps that are unvalidated hypotheses     |
| `evidence` | mean `base·(1 − tier)` across steps              | real steps with weak/absent sources       |
| `coverage` | `1 − coverageFraction`                           | physical invariants never exercised       |
| `weakLink` | `max cᵢ − min cᵢ`                                | brittleness: one bottleneck dominates     |

They are reported as a **relative attribution** (normalised to 100%) — a lens on
*where* uncertainty concentrates, plus the single **dominant** source and one
**actionable lever** mapped to it.

## Worked example — the two APP → Char mechanisms

```
crosslink route (app:solid → crosslinked → char)   MRI = 0.06
    coverage   16.9%
    evidence   18.1%
    weakLink   22.8%
    modelGap   42.2%   ← dominant
  → validate the unvalidated step app_xl2 — observe to raise status

polyphosphoric-acid route (app:solid → PPA → char)  MRI = 0.18
    coverage   24.7%
    evidence   37.0%   ← dominant
    weakLink    7.4%
    modelGap   30.9%
  → add instrument evidence (TGA/DSC/FTIR) on app_ppa2 — raises its source tier
```

The two routes are uncertain for **different reasons**, and C.2 separates them.
The crosslink route is a *hypothesis* — its dominant deficit is `modelGap`, so the
lever is *observe it at all*. The PPA route is an *accepted mechanism* whose
weakest link is under-instrumented — its dominant deficit is `evidence`, so the
lever is *measure it better*. A scalar MRI cannot tell these apart; the
attribution does. That difference is exactly what an experiment planner needs.

## Why the dominant source maps to a *different* action each time

- `modelGap` → **validate** the unvalidated step(s) (raise status by observation).
- `evidence` → **instrument** the weakest step (raise its source tier).
- `coverage` → **exercise** an untested invariant on the path.
- `weakLink` → **target the bottleneck** step specifically (the one capping the path).

## Honest limits

- The per-step `1 − c = (1 − base) + base·(1 − tier)` split is an **exact
  identity**. The path-level roll-up into four sources and their normalisation to
  100% is a **relative attribution**, *not* an exact additive identity — `coverage`
  and `weakLink` are path-geometry terms that don't live on the same axis as the
  per-step confidence shortfall. It answers "where is uncertainty concentrated?",
  not "these percentages sum to the MRI gap." This is deliberate and documented.
- Heuristic-by-design in the same way as the rest of Stage B: the weighting of
  the four sources is uniform (each contributes its raw magnitude); a future
  calibration (C.5) can learn better weights from outcomes.
- Numbers are over illustrative fixtures; real values arrive with ingestion.

## Stage C roadmap

C.1 Alternative Path Generator ✅ · **C.2 Uncertainty Attribution ✅** · C.3
Information Gain Engine ✅ (expected uncertainty reduction per measurement — see
`MBM-Stage-C-InformationGain.md`) · C.4 Experiment Planner (IG ÷ cost×time → best
next experiment) · C.5 Historical Learning (update source-reliability from past
runs) · C.6 Reliability-Gated Decision Hand-off · C.7 Uncertainty Budget Burndown
· C.8 Knowledge Tension Map · C.9 Explicit Epistemic State.

### Two integrating ideas (added to the roadmap)

Beyond the agreed C.3–C.5 spine, two ideas make the reliability machinery
*matter* outside the MBM — they connect it to the Decision Boundary and to the
lab's actual progress over time:

- **C.6 — Reliability-Gated Decision Hand-off.** Today MRI, weakest link, the
  C.2 attribution and the recommended next experiment are computed but stay
  *inside* the MBM. This idea makes them **travel with any MBM conclusion** as it
  crosses into the Decision Workspace / Engine Contract `emits`. Concretely: an
  MBM conclusion cannot be emitted as `evidence`/`prediction` above a given class
  unless its MRI and dominant-uncertainty type are attached, and a low-MRI
  conclusion is *structurally* barred from masquerading as `fact` — the
  attribution becomes the enforcement mechanism for the Decision Boundary, not
  just a report. This closes the loop between "the model knows how much it trusts
  itself" and "the system refuses to over-claim."

- **C.7 — Uncertainty Budget Burndown.** C.2 gives a *snapshot* of where
  uncertainty lives. This idea tracks it **over time**: treat total model
  uncertainty as a budget and measure whether each experiment the lab actually
  runs *burns it down* — did the predicted Information Gain (C.3) materialise as a
  real MRI increase after the result came back? It turns the C.3→C.4→C.5 loop
  into a measurable feedback signal ("our experimental program reduced modelGap
  by X% this quarter; evidence-uncertainty is now dominant"), and feeds
  Meta-Learning: an experiment type that repeatedly under-delivers its predicted
  IG gets its expected-gain model corrected. This is what makes the reasoning
  engine *learn to plan better*, not just plan.
```
