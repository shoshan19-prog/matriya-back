# MATRIYA Capability Planner v1.0 (on paper)

**Status: standard locked (docs only). No runtime code, no Composer, no execution,
no `runSearch()`.**

The four standards were locked — Scientific Task Contract, Capability Ontology,
Engine Contract v1.1, Decision Workspace — but nothing yet *connected* them. The
Capability Planner is that connector: a **pure resolver** that turns a task into a
plan. It is **not** a Composer (it does not run engines) and **not** an executor
(it produces no results). It is the last design piece before code.

```
Scientific Task Contract  →  Capability Ontology  →  Engine Contract  →  Decision Workspace
                         └──────────────  Capability Planner  ──────────────┘
                                    (task graph → engine plan → workspace inputs)
```

Schema: [`capability-planner.schema.json`](./capability-planner.schema.json).
Worked example (derived from the real contracts):
[`plans/reduce-fire-spread.plan.json`](./plans/reduce-fire-spread.plan.json).

## What the planner does (and does not)

For each capability node in the task's graph, it:
1. **Expands** derived capabilities to primitives via the Capability Ontology
   (`compare → observe + explain`).
2. **Selects** an engine per primitive by the rules below — matching *capability
   vectors*, never engine names from the task.
3. **Plans the emissions** each selected engine will produce (from its Engine
   Contract `emits`), and **routes them to Decision Workspace sections**.
4. If a required capability is unmet, it **reports a typed gap** — it never
   invents an engine or fakes a plan.

It never runs anything and never plans a decision.

## Selection rules (deliverable 5)

Applied in order; the first two are hard filters, the rest rank/tie-break:

1. **Capability match** — `engine.capabilities[primitive] ≥ node.minStrength`.
2. **Safety compatibility** — the engine's `outputEpistemics` must satisfy the
   task's `safety`. E.g., a `generate` step under a task requiring
   `generatedOutputsAreHypotheses` may only use an engine whose `outputClass =
   hypothesis` + `validationGating = human_gated`.
3. **Reasoning fit** — prefer a `reasoning.class` / `confidenceType` appropriate
   to the capability (validation → `independent_evidence`; generation →
   `generative`), so confidence types are never conflated downstream.
4. **Purity** — prefer `pure` engines for steps that may be retried/parallelised;
   flag `stateful` ones (they cannot be freely retried).
5. **Cost then latency** — cheaper, then faster (tie-break).
6. **Determinism / reproducibility** — prefer deterministic or seeded engines for
   an auditable plan.

## Gap reporting (deliverable 4) — the sibling of Constraint Resolution

If no engine passes the hard filters, the planner emits a **typed gap** rather
than "no plan":

| `reason` | meaning |
|----------|---------|
| `no_engine_provides_capability` | nothing declares the primitive at all |
| `insufficient_strength` | an engine provides it, but below `minStrength` |
| `safety_incompatible` | the only providers violate the task's safety envelope |
| `unmet_dependency` | a provider needs a datastore/model that isn't available |

This is deliberately the same discipline as your **Constraint Resolution Engine**:
never "no solution found" — always *which* thing blocks, and *why*. A gap on a
required node → `status: blocked`; a gap on a non-critical node → `status:
partial`; the plan still reports everything it *could* cover.

*Example:* a task node needing `predict ≥ 4` with the current four engines (best
`predict` = 3, combination-discovery) yields
`{ reason: "insufficient_strength", capability: "predict", requiredStrength: 4,
bestAvailable: { engine: "combination-discovery", strength: 3 } }` — a precise,
actionable signal for the next engine to contract, exactly as the `recommend` gap
earlier produced the Recommendation Engine.

## Decision boundary (deliverable 6)

The plan carries three `const` guarantees: `plannerSelectsDecision: false`,
`assemblesWorkspaceInputs: true`, `humanDecisionExternal: true`. The plan
**terminates at the Decision Workspace** (`workspacePlan.terminal =
"decision-workspace"`), never at a decision. Because `plannedEmissions` are drawn
from the Engine Contract v1.1 `emits` vocabulary — which has no `decision` — the
planner *cannot* plan a decision even by mistake. The planner assembles the
surface; the human decides.

## No execution (deliverable 7)

The plan artifact has `executed: false` (a `const`) and carries **no results** —
only intended engine invocations and their declared emission *types*. Running the
plan is a separate, later concern (the Composer / G7), explicitly out of scope.

## Worked example: "reduce fire spread"

The task's capability graph (observe→compare→generate→validate→explain) resolves,
against the four real engine contracts, to `status: planned` with **zero gaps**:

| node | capability | assigned (primitive : engine @ strength) | planned emissions → sections |
|------|-----------|------------------------------------------|------------------------------|
| n1 | observe | observe : ikl-search @5 | observation, evidence → evidenceQuality |
| n2 | compare | observe : ikl-search @5 · explain : recommendation @4 | (composed) |
| n3 | generate | generate : combination-discovery @5 *(hypothesis+human-gated ✔ safety)* | candidate → alternatives; prediction → whatIf; trade_off → tradeOffs; risk → risks; missing_evidence → missingEvidence |
| n4 | validate | validate : knowledge-event @4 | evidence, confidence → evidenceQuality |
| n5 | explain | explain : recommendation @4 | recommendation → alternatives; trade_off/risk; confidence → uncertainty |

`compare` (a derived capability) is **composed** from two engines — there is no
dedicated Comparison engine, and the planner covers it via `observe + explain`
rather than failing. Every emission is routed to a workspace section; the plan
ends at the Decision Workspace; nothing is executed; no engine name appears in the
task. (Plan generated directly from the contracts and validated against the
schema.)

## Success question

**Can the planner connect Task Contract, Engine Contract and Decision Workspace
without naming engines inside the task and without executing anything? — Yes.**

- The **task** stays capability-only (`referencesEngines: false`, echoed in the
  plan); engines appear **only** in the plan's assignments — planning is where
  capability becomes engine.
- The plan **assembles Decision Workspace inputs** and terminates there; it never
  selects or plans a decision (structurally — the emit vocabulary excludes it).
- The plan **executes nothing** (`executed: false`, no results).

With this locked, **G7 is now the first engineering step on a complete
architecture** — `runSearch` becomes the execution of one assignment in a plan,
not a standalone function to be rewritten as the platform grows. The design stack
is closed: Task → Ontology → Planner → Engine → Workspace → Human → Knowledge
Event → learning.
