# MBM Stage B — Model Reliability & Scientific Readiness

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

Stage B turns the Material Behavior Model from a *consistent model* into a
**Scientific Reliability Engine**: it does not just say a transition is possible —
it says **how much its own conclusion can be trusted**, *before* real TGA/DSC data
arrives. Every conclusion now carries six layers of information.

Harness: `npm run test:mbm-reliability` (+ `test:mbm-invariants` for layer 1),
both wired into `test:unit`. Logic: `scripts/mbm-reliability.mjs`,
`scripts/mbm-invariants.mjs`.

## The six reliability layers

| # | Layer | Question it answers | Where |
|--:|-------|---------------------|-------|
| 1 | **Physical Validity** | Is the transition physically consistent? | invariant suite (5 invariants) |
| 2 | **Coverage** | How much of the physics was actually *tested*? | `computeCoverage()` |
| 3 | **Confidence** | How much do we trust it (per step, and along a path)? | `transitionConfidence` / `propagatePath` |
| 4 | **Sensitivity** | Which experiment would strengthen it most? | `evidenceSensitivity` |
| 5 | **Explainability** | *Why* did the model conclude this? | `explainTransition` |
| 6 | **Weakest Link** | *Where* is the largest uncertainty? | `propagatePath().weakest` |

Bundled by the **Model Reliability Index (MRI)**:
`MRI = pathConfidence × validityFactor × coverageFactor`.

## Layer 2 — Confidence & propagation

Per-transition confidence: `c_i = base(status) × sourceTier(evidence)` (+ a small
multi-evidence boost). `base`: replicated 0.9, observed 0.8, mechanism_supported
0.7, predicted 0.5, hypothesized 0.3. `sourceTier`: instrument (TGA/DSC/FTIR/XRD/
SEM) 1.0, standard/TDS 0.95, paper 0.8, literature 0.7, illustrative 0.6, **no
evidence 0.5** (inference only).

Path confidence is the **product** (weakest-link aware): a chain is no stronger
than its worst step, so — exactly your worked example — a path through one weak
transition collapses:

```
epoxy: glassy→rubbery→degraded→char
  thermal_1 c=0.48
  thermal_2 c=0.42   ← weakest (single source; no instrument confirmation)
  thermal_3 c=0.42
  Path confidence = 0.085   (NOT 0.48) · MRI = 0.076
```

The low absolutes are honest: the fixtures carry *illustrative* evidence
(sourceTier 0.6). When a real DSC/TGA arrives, that step's tier → 1.0 and
confidence rises — which is precisely what layer 4 quantifies.

## Layer 6 — Weakest-Link Detector

The engine reports not just a number but *where it breaks and why*:

```
silane → photo-degradation
  hyp_1 c=0.15  ← weakest: unvalidated (status: hypothesized); no evidence (inference only)
  Path confidence = 0.042 · MRI = 0.038
```

## Layer 4 — Evidence Sensitivity (which experiment is worth doing)

For a transition, each instrument is scored by how much *confirming* it would
raise confidence — a relevant instrument that promotes an unvalidated transition
to `observed` gains the most; irrelevant ones barely move it:

```
hyp_1 (silane photo-degradation, unvalidated):
  ftir    Δ +0.65  (relevant)
  uv_vis  Δ +0.65  (relevant)
  tga     Δ +0.15
  dsc     Δ +0.15
```

This flips MBM from passive model to an engine that **directs experiments** — and
verified: a weak transition gains more from a new experiment than a well-supported
one does.

## Layer 5 — Explainability

Every transition explains itself — auditable when there are hundreds:

```
thermal_2:  epoxy:rubbery → epoxy:degraded  via "chain scission"
  evidence: illustrative | invariants: mass=exception, entropy=ok, causality=ok,
  equivalence=ok, continuity=ok | c=0.42
```

## Honest limits

- All layers are **heuristic by design** (calibrated trust, not a physics solver):
  the `c_i` model, the tier weights, the MRI formula and the instrument-relevance
  map are documented, tunable starting points — not ground truth. `w_i` position
  weights default to 1.
- Reliability is a **measurement, not a gate** — it never rejects a transition
  (the invariant suite is the gate); it reports trust so a human can judge.
- Numbers are computed over illustrative fixtures; real values arrive with (b)
  ingestion, when evidence tier and status reflect actual TGA/DSC/FTIR.

## Outcome

```
Reality → Observation → Transition → Invariant Qualification → Coverage
       → Confidence → Weakest Link → Explainability → MRI → Ready for TGA/DSC
```

The instrument is calibrated: when a real curve is ingested, a surprising result
can be attributed cleanly — model rejected it (invariants), the data is anomalous,
or the conclusion is simply low-confidence (MRI/weakest-link) and needs the
experiment that sensitivity points to.
