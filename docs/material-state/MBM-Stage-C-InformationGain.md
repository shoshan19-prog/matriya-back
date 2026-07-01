# MBM Stage C.3 — Information Gain Engine

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

C.2 diagnosed *why* a conclusion is uncertain. C.3 asks the next question — **not
"which experiment should I run?" but "how much would each possible experiment
reduce the uncertainty, and which part of it?"** This is **valuation, not
selection**. Choosing a portfolio of experiments under real cost/time is C.4
(Experiment Planner). Keeping the two apart is a deliberate architectural line:

> **Diagnosis (C.2) → Valuation (C.3) → Planning (C.4).**
> C.3 never picks an experiment. It puts a price of *information* on each one.

Harness: `npm run test:mbm-infogain` (wired into `test:unit`). Logic:
`scripts/mbm-info-gain.mjs` — `informationGain(doc, ids)`. It **consumes C.2's
output directly**: C.2 now returns its raw (un-normalised) component magnitudes,
and C.3 measures how much each experiment shrinks them.

## How the value is measured — counterfactual re-simulation

Each candidate experiment is an **epistemic upgrade to an existing transition** —
no new chemistry is fabricated (respecting the no-invented-physics discipline):

| Candidate | Projected effect | Attacks |
|-----------|------------------|---------|
| `observe(T)`    | a confirming observation promotes `status → observed` (raises base) | `modelGap` |
| `instrument(T)` | a relevant instrument (TGA/DSC/FTIR/…) adds tier-1 evidence and promotes an unvalidated step | `evidence` (+`modelGap` if it was a hypothesis) |

Candidates are **auto-derived from the path's own deficits** — an `observe` only
for unvalidated steps, an `instrument` only where a relevant instrument exists and
the evidence isn't already tier-1. For each one we apply the projected effect to a
copy of the model, **re-run C.2**, and report:

- **Expected ΔMRI** — `MRI_after − MRI_before`.
- **Per-component reduction** — `before.raw[k] − after.raw[k]` for each of
  `modelGap / evidence / coverage / weakLink`, and which component it **attacks**
  most. (This is the direct C.2→C.3 hand-off.)
- **Competing mechanisms it would decide** — the alternative routes (same
  endpoints, from C.1) that include the target transition; those are the
  hypotheses whose standing the experiment moves.
- **Estimated cost & time** + a derived `efficiency = ΔMRI ÷ (cost×time)` —
  **reported for C.4, not used for ranking here.**

Candidates are **ranked by expected ΔMRI** (pure information value).

## Worked example — the two APP → Char mechanisms

```
crosslink route (app:solid → crosslinked → char)   before: MRI=0.06  dominant=modelGap
  1. instrument app_xl2 (TGA)  ΔMRI +0.246  attacks:modelGap   reduces{ modelGap:0.25, evidence:0.075 }
  2. observe    app_xl2        ΔMRI +0.095  attacks:weakLink   reduces{ modelGap:0.25, weakLink:0.25 }
  3. instrument app_xl1 (TGA)  ΔMRI +0.043  attacks:evidence   reduces{ evidence:0.14 }

polyphosphoric-acid route (app:solid → PPA → char)  before: MRI=0.18  dominant=evidence
  1. instrument app_ppa1 (TGA) ΔMRI +0.136  attacks:evidence   reduces{ evidence:0.16 }
  2. instrument app_ppa2 (TGA) ΔMRI +0.136  attacks:evidence   reduces{ evidence:0.14 }
```

C.2 said the crosslink route is `modelGap`-dominated (it's a *hypothesis*); C.3's
top experiment is precisely the one that attacks `modelGap` on the hypothesized
step `app_xl2`. C.2 said the PPA route is `evidence`-dominated (accepted mechanism,
under-instrumented); C.3's value is in the TGA/DSC that raise the evidence tier.
**The diagnosis and the recommended experiment agree by construction** — that is
the whole point of the C.2→C.3 chain.

## Two guardrails honoured (from review)

1. **MRI is a summary metric, never a decision criterion.** C.3 ranks by *ΔMRI*
   (the *reduction*), and the reduction is broken down per component — decisions
   rest on the decomposition, not on crossing an absolute-MRI threshold. There is
   no `MRI > 0.7`-style gate anywhere in the engine.
2. **Diagnosis ≠ planning.** C.3 stops at valuation. Cost, time and efficiency are
   *reported* so C.4 can do `IG ÷ (cost×time)` portfolio selection, but C.3's own
   ranking ignores them.

## Honest limits

- **Corroboration-case value.** ΔMRI assumes the experiment yields its *intended*
  effect. A refuting result can *raise* uncertainty (or force a `modelGap`); that
  branch is Surprise Analysis, a later stage — not modelled here. This is stated,
  not hidden.
- **Coverage experiments are out of scope for C.3.** `observe`/`instrument`
  upgrade *existing* transitions. Reducing the `coverage` deficit means exercising
  an invariant that no transition on the path touches — that is a *discovery* of
  new behaviour, which belongs to ingestion, not to a confirmation experiment. So
  C.3's candidates attack `modelGap`/`evidence`/`weakLink`; `coverage` stays a
  diagnostic signal from C.2.
- **Heuristic-by-design**, like all of Stage B/C: the projected effects, the
  status/tier model, and the illustrative cost/time table are documented, tunable
  choices. Real numbers arrive with ingestion.

## Stage C roadmap

C.1 Alternative Path Generator ✅ · C.2 Uncertainty Attribution ✅ · **C.3
Information Gain Engine ✅** · C.4 Experiment Planner ✅ (portfolio selection: IG ÷
cost×time, consumes C.3's `efficiency`/`competingResolved`/`experimentType` — see
`MBM-Stage-C-ExperimentPlanner.md`) · C.5 Historical Learning · C.6
Reliability-Gated Decision Hand-off · C.7 Uncertainty Budget Burndown · C.8
Knowledge Tension Map · C.9 Explicit Epistemic State · C.10 Prediction Calibration
· C.11 Mechanism Consensus · C.12 Research Readiness Index · C.13 Contradiction
Memory · C.14 Evidence Aging · C.15 Discovery Opportunity Map.

Note: C.3 candidates now also carry a scientific `experimentType` (Measurement /
Validation today; Perturbation / Comparison / StressTest recognised in the
taxonomy), consumed by C.4.

### Two further integrating ideas (from review, added to the roadmap)

- **C.8 — Knowledge Tension Map.** C.1–C.3 reason about a single *path*. This
  lifts uncertainty to the **whole model**: a map of the state/transition graph
  coloured by *stable* regions (well-evidenced, invariants exercised), *tension*
  regions (competing mechanisms of similar reliability — C.1 disagreement),
  *contradiction* regions (invariant exceptions / near-violations clustering), and
  *coverage-gap* regions (no transitions, or all unvalidated). It answers the
  research-management question C.2 can't: **where in the model as a whole is
  uncertainty concentrated** — so a lab head can direct effort, not just rank the
  next experiment.
- **C.9 — Explicit Epistemic State.** Alongside the scalar MRI, tag each
  path/conclusion with a discrete epistemic state — `Hypothesized` /
  `Corroborated` / `Confirmed` / `Refuted` / `Undecidable`. Two paths can share an
  MRI yet be epistemically different (a well-measured *hypothesis* vs. a
  thinly-sourced *confirmed* mechanism). The state is derived from status +
  evidence tier + invariant standing, not from the number — and it is exactly the
  layer that will *change discretely* when real TGA/DSC data lands (Corroborated →
  Confirmed, or → Refuted, triggering Surprise Analysis). It also gives C.6 a
  clean, non-numeric gate for the Decision Boundary: only `Confirmed` conclusions
  may be emitted as `fact`.
```
