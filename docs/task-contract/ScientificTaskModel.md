# MATRIYA Scientific Task Model — Capability Ontology v1.0 + Scientific Task Contract v1.0

**Status: standards locked (docs only). No code, no Composer, no `runSearch()`.**

The Engine Contract answered *how an engine looks*. It does not answer *what the
user is trying to achieve*. This layer does — and it is the layer that lets a
Composer plan by **capability**, never by engine name. Two standards:

- **Capability Ontology v1.0** — the shared vocabulary joining what tasks
  *consume* to what engines *provide*.
- **Scientific Task Contract v1.0** — a formal description of a research task
  (intent → task type → capability graph).

## The hierarchy this completes

```
User Goal (intent)
   ↓  Scientific Task Contract      — what the user wants (this layer)
   ↓  Capability Ontology           — the shared vocabulary (this layer)
   ↓  Capability Planner            — matches needs to providers (future: the Composer's front half)
   ↓  Engine Contract v1.1          — how each engine looks (frozen; engines emit — never decide)
   ↓  Engine Graph                  — engines emit evidence / candidates / recommendations / trade-offs / risks
   ↓  Decision Workspace            — assembles the surface; NEVER a decision (see DecisionWorkspace.md)
   ↓  Human Decision                — OUTSIDE the Engine Platform
   ↓  Knowledge Event → ΔK          — the decision's result re-enters as learning (loop)
```

**The Decision Boundary** (Engine Contract v1.1): a decision is never an engine
output. See [`DecisionWorkspace.md`](./DecisionWorkspace.md).

Everyone else builds `Agent → tool-calling`. This builds `Scientific Intent →
Scientific Task → Capability Graph → Scientific Reasoning` — the Composer never
needs to know an engine's name, only its capabilities.

## 1. Capability Ontology v1.0

Files: [`capability-ontology.schema.json`](./capability-ontology.schema.json),
[`capability-ontology.v1.json`](./capability-ontology.v1.json).

- **7 primitive capabilities** — `observe, explain, predict, recommend, generate,
  validate, learn`. These are **identical to the frozen Engine Contract v1.0
  capability-vector axes.** That identity is deliberate: it makes the task↔engine
  join *total* — every capability a task can require is one an engine can declare.
- **Derived capabilities** — `compare, diagnose, optimize, prioritize`. Tasks may
  reference these; engines do **not** self-declare them. The Planner expands a
  derived capability into its primitives (`compare = observe + explain over ≥2
  subjects`) and matches those.
- **Task types** — `diagnosis, comparison, optimization, ideation, validation,
  experiment_planning, prediction, selection, explanation, solution_discovery`,
  each with a typical capability flow.

**Reconciliation note (important).** Your task examples used `compare`, which is
*not* one of the 7 frozen engine axes. Rather than reopen the frozen Engine
Contract, v1.0 keeps the 7 primitives as the atoms and models `compare` (and
`diagnose`, `optimize`, `prioritize`) as **derived** — compositions the Planner
resolves. If experience shows `compare`/`diagnose` should become first-class
engine axes, that is a future *Engine Contract* consideration, not a task-model
hack. The freeze holds; expressiveness is added above it.

## 2. Scientific Task Contract v1.0

File: [`scientific-task-contract.schema.json`](./scientific-task-contract.schema.json).

A task carries: `intent` (the user's own words), `taskType`, `subject`, optional
`valueWeights` (the Value Field goal weighting), a `capabilityGraph` (a small DAG
of capability nodes with `minStrength`), `successCriteria`, `outputExpectation`
(default `scientific_narrative` — explainable, provenance-bound, not raw data),
and `safety`.

Two governing rules, both structural:
- **`referencesEngines: false`** (a `const`) — a task declares it names no engine.
  Capabilities only.
- **Generation inherits the engine safety envelope** — a schema rule: if the
  graph contains `generate`/`optimize`, then `safety.generatedOutputsAreHypotheses`
  and `humanValidationRequiredForPromotion` must be `true`. So the epistemic
  boundary set in the Engine Contract propagates *up* to the task level.

Test-case tasks (from your examples):
[`reduce-fire-spread`](./tasks/reduce-fire-spread.task.json)
(`solution_discovery`: observe→compare→generate→validate→explain) and
[`reduce-water-absorption`](./tasks/reduce-water-absorption.task.json)
(`diagnosis`: observe→diagnose→recommend→explain).

## 3. The join — proven against the three real engine contracts

Running the two tasks against the frozen capability vectors of `ikl-search`,
`knowledge-event` and `combination-discovery` (no engine named in either task):

| Task | Capability | Resolves to (primitive @ strength via engine) | Result |
|------|-----------|-----------------------------------------------|--------|
| Fire spread | observe(4) | observe 5 via ikl-search | covered |
| | compare(3) | observe 5 (search) + explain 3 (knowledge-event) | covered |
| | generate(4) | generate 5 via combination-discovery | covered |
| | validate(3) | validate 4 via knowledge-event | covered |
| | explain(3) | explain 3 via knowledge-event | covered |
| | **→ fully satisfiable by the existing 3 engines** | | ✅ |
| Water absorption | observe(4) | observe 5 via ikl-search | covered |
| | diagnose(3) | observe 5 + explain 4 + predict 3 | covered |
| | recommend(3) | recommend 5 via **recommendation (Engine 3)** | covered |
| | explain(3) | explain 4 via recommendation | covered |
| | **→ fully satisfiable** (gap closed by Engine 3) | | ✅ |

> **Gap → closed.** The `recommend` gap this table originally surfaced was closed
> by contracting the **Recommendation Engine (Engine 3)** — a capability the
> planner *demanded*, not an engine someone wanted to build. See
> [`../engine-contract/RecommendationEngine-mapping.md`](../engine-contract/RecommendationEngine-mapping.md).
> This is the loop working: task → capability need → gap → new engine → re-plan → satisfiable.

Two things this proves:
1. **The Composer can plan by capability alone.** Both tasks resolve to concrete
   engines through the ontology, with zero engine names in the task.
2. **The model reports gaps instead of guessing.** "Reduce water absorption"
   needs `recommend ≥3`; no engine provides it (best is 2). The Planner would
   surface *"no engine provides `recommend` at the required strength"* — which is
   a data-driven signal for the next engine to contract (a Recommendation engine,
   Engine 3), not a silent bad answer. The capability layer is also a **coverage
   map** of the engine platform.

## 4. Why this before G7

G7 (`runSearch`) *implements* a decision already made — it doesn't change the
system's value. This layer changes what the system *is*: from "a set of engines"
to "a system that turns intent into a planned capability graph." With both
standards locked, the first line of code (G7) will already sit inside the full
architecture — `runSearch` becomes the first engine invoked by a capability node,
not a standalone function to be rewritten when the platform grows from tens to
hundreds of engines.

**Nothing here is implemented.** Next natural steps, on approval and in order:
(a) contract the missing-capability engines the gap map reveals (`recommend` →
Engine 3); (b) the Capability Planner (pure resolution: task graph → engine plan,
still no execution); (c) then G7, the first engine that actually runs.
