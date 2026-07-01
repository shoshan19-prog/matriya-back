# MATRIYA — Production Readiness Report (what's left before going live)

**Where we are:** the simulator is built and validated. The MBM is a calibrated
scientific instrument (Stage C complete), the Failure KB is proven to generate
knowledge (illustrative + standards-grounded pilots), and the ingestion pipeline
is **designed** with biting gates. Nothing has been ingested; no decisions are
automated. This report lists what remains between *simulator* and *field*.

## Done (green, on branch)

- **G7** SearchEngine `runSearch` behind `/ikl/search` (behaviour-preserving).
- **MBM** ontology + 5 invariants + reliability (confidence/MRI/weakest-link).
- **Stage C** reasoning loop: C.1 alt-paths · C.2 uncertainty attribution · C.3
  information gain · C.4 experiment planner · C.5 learning · C.8 tension map · C.9
  epistemic state · C.10 calibration · C.12 RRI · C.13 contradiction memory · C.14
  evidence aging (dormant) · C.15 discovery · Stage C Report.
- **Failure KB** schema + 16-case corpus + pattern engine + negative knowledge +
  MBM pilot (yields: 8 competing mechanisms, 16 experiments, 9 ΔK) + **provenance
  pilot** (7 cases grounded in real standards, yields survive).
- **Ingestion pipeline design** + gate check (6 gates, all bite).
- **24 test suites green** (unit chain), all docs-only / measurement-only.

## Gaps to production (prioritised)

### P0 — foundational
1. **Build the ingestion pipeline** from the design: intake UI/API, provenance
   review queue, citation-anchor store, dual-control sign-off, quarantine/rollback.
   *Design done; implementation not started.*
2. **Curate a real sourced corpus** (human-in-the-loop): replace illustrative cases
   with sourced ones (confirmed editions/DOIs). Start with the 4 pilot families.
3. **Environment/build:** the full `test:unit` chain still trips on broken native
   deps in this sandbox (`axios`/`bcrypt`). Production needs a clean
   `node_modules` + CI that runs the whole chain green. *(Environmental, not code.)*

### P1 — activate what's already built
4. **Real calibration:** replace C.10's illustrative `simulateObserved` with actual
   experiment ΔMRI once data flows; let **C.5** learn from real history.
5. **Activate C.14 Evidence Aging** with real source dates (currently dormant).
6. **MBM model evolution:** promote the ΔK the corpus surfaced (new states
   `app:char_oxidized`, `concrete:sulfate_expanded`, silicate region; the
   `concrete→steel` cross-subsystem coupling) into the MBM ontology/fixtures — a
   human-reviewed step; today they live only as ΔK candidates in the corpus.

### P2 — deferred engines (need sourced data / cross-model work)
7. **C.6 Reliability-Gated Decision Hand-off** — enforce the Decision Boundary on
   emit (no low-MRI / non-`Confirmed` output as fact).
8. **Surprise Analysis** — the refutation branch (predicted gain, observed loss);
   hooks already left by C.10/C.13.
9. **C.11 Mechanism Consensus (triangulation)** and **C.7 Uncertainty Budget
   Burndown** — need multiple independent sourced paths / longitudinal history.

### P3 — runtime & governance
10. **Engine runtime integration:** Stage C engines are pure functions over
    fixtures; wire them behind the Engine Contract / API for live use.
11. **Governance:** operationalise dual-control sign-off, licensing/PII handling at
    intake, and audit trails for every promotion.
12. **Decision Boundary enforcement end-to-end:** engines emit
    evidence/uncertainty/recommendation only; a human owns every decision.

## Recommended sequence

```
P0.1 build pipeline  →  P0.2 curate small real corpus  →  P1.4/1.5 real
calibration + aging  →  P1.6 promote ΔK into the MBM  →  P2 deferred engines
→  P3 runtime + governance
```

## The line we have not crossed (by design)

No ingestion. No fetch. No autonomous decision. No invented chemistry. MRI/RRI are
gauges, never gates. Everything shipped is measurement / recommendation / report.
Going live means building the pipeline and feeding it *real, human-verified*
sources — not loosening any of these boundaries.
