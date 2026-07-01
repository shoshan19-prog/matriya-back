# MBM Stage C.1 — Alternative Path Generator

**Status: standard + runnable harness (docs + tests). No engine execution, no
ingestion.**

Stage C moves the MBM from *reliability* ("how much can I trust this transition?")
to *knowledge gain* ("what should I do next to know more?"). C.1 is the smallest
first step and the substrate for the rest: instead of a single path, the model
enumerates **all physically-valid explanations** for how a material gets from
state A to state B, and ranks them by reliability. This is where it starts to
behave like a scientist proposing competing hypotheses.

Harness: `npm run test:mbm-altpaths` (wired into `test:unit`). Logic:
`scripts/mbm-alt-paths.mjs` — it reuses the graph, the 5 invariants, and the
Stage-B confidence model; it adds no new physics.

## What it does

`generatePaths(doc, from, to)`:
1. Enumerates every simple path (no revisited state, bounded depth) of **real**
   transitions from `from` to `to`.
2. Keeps only paths where **every** step passes the 5 invariants (physically
   valid — no non-physical route survives).
3. Ranks them by **pathMRI**, and reports each with its compound confidence and
   weakest link.

For an unreachable query it returns **nothing** — never a fabricated path.

## Worked example — APP → Char (intumescent fire-retardant, our domain)

```
1. app:solid → app:polyphosphoric_acid → app:char
   pathMRI 0.40  | avg-link 0.45 | compound 0.20 | weakest: app_ppa2 (single source; no instrument confirmation)
2. app:solid → app:crosslinked → app:char
   pathMRI 0.23  | avg-link 0.25 | compound 0.06 | weakest: app_xl2 (unvalidated hypothesis; no evidence)
3. app:solid → app:char
   pathMRI 0.14  | avg-link 0.15 | compound 0.15 | weakest: app_direct (coarse direct-charring hypothesis)
```

The well-evidenced polyphosphoric-acid mechanism ranks above the crosslink route,
which ranks above the coarse "it just chars" hypothesis — exactly the ordering a
chemist would give.

## Ranking metric — a deliberate, documented choice

Stage-B **path confidence** is a *product* (compound end-to-end trust) and
necessarily shrinks with length. For comparing alternative explanations of the
*same* endpoints, that unfairly favours short/coarse routes (a 1-step guess would
beat a 2-step well-evidenced mechanism). So **ranking uses the length-neutral
geometric mean** of step confidences (average per-link trust) × validity ×
coverage:

```
pathMRI = geoMean(step confidences) × validityFactor × coverageFactor
```

The compound product confidence and the weakest link are still reported, so
nothing is hidden — you see both "how strong is each link on average" (ranking)
and "how much trust survives end-to-end" (compound).

## Honest limits

- Heuristic-by-design, like the rest of Stage B (the confidence model, the
  geo-mean ranking, the coverage factor are documented, tunable choices).
- Simple paths only (no revisited states), bounded depth — cycles are excluded by
  construction (consistent with the causality invariant).
- Numbers are over illustrative fixtures; real values arrive with ingestion.

## Stage C roadmap (agreed)

C.1 Alternative Path Generator ✅ · C.2 Uncertainty Attribution (decompose a low
MRI into coverage-gap / source-reliability / brittleness) · C.3 Information Gain
Engine (expected uncertainty reduction per measurement) · C.4 Experiment Planner
(IG ÷ cost×time → best next experiment) · C.5 Historical Learning (update
source-reliability from past runs).
