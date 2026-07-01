# MATRIYA Decision Workspace v1.0 + the Decision Boundary

**Status: standard locked (docs only). No code, no Composer, no `runSearch()`.**

This layer answers a question the earlier layers exposed but did not resolve:
**where does a decision live?** The answer is a foundational principle, not a
feature.

## The principle: a Decision is never an Engine output

Every engine returns an *output*: Search → results, Knowledge Event → event,
Combination Discovery → candidates, Recommendation → ranked alternatives. But a
**decision is not the output of any engine.** A decision is a *human act*, taken
over many outputs, under responsibility no engine can hold.

So the fix for RG3 is not `outputClass = decision_support`. It is a **Decision
Boundary**, enforced in two places:

1. **Engine Contract v1.1** — every engine declares `outputEpistemics.emits` from
   a closed vocabulary: `observation · evidence · explanation · prediction ·
   candidate · recommendation · trade_off · risk · confidence · missing_evidence`.
   **`decision` is deliberately not in the vocabulary** — so no engine can ever
   declare it emits one. (Verified: all four engine instances validate, none
   emits `decision`.)
2. **Decision Workspace** (this standard) — a separate architectural entity, *not
   an engine*, that assembles engine emissions into the surface a human decides
   on. It declares `isEngine: false`, `producesDecision: false`,
   `humanDecisionExternal: true`.

> The engines do not decide. They build the decision space. The human decides.

## The architecture this completes

```
Scientific Task
      ↓  Capability Planner        (task capabilities → engine graph, by capability not name)
      ↓  Engine Graph              (engines emit: evidence, candidates, recommendations, trade-offs, risks…)
      ↓  Decision Workspace        (assembles the surface — NEVER a decision)
      ↓  Human Decision            (OUTSIDE the Engine Platform — a person, with responsibility)
      ↓  Knowledge Event           (the RESULT of the decision re-enters the system)
      ↓  ΔK → learning             (the loop closes; the next task is better informed)
```

Note the loop: **a decision is not the end of the process — it is the start of
the next learning cycle.** The human decides → an experiment runs → a Knowledge
Event is born → ΔK → the system learns. The Knowledge Event Engine (already
contracted) is exactly the re-entry point.

## What a Decision Workspace holds

Schema: [`decision-workspace.schema.json`](./decision-workspace.schema.json).
Example: [`workspaces/reduce-fire-spread.workspace.json`](./workspaces/reduce-fire-spread.workspace.json).

- `surface` — alternatives, trade-offs, risks, evidence quality, uncertainty,
  **missing evidence**, and what-if scenarios. Everything a human needs to decide,
  and nothing that decides for them.
- `contributingEmissions` — transparency: which capability (and, for the user,
  which engine) produced each part of the surface. Emission kinds come from the
  Engine Contract v1.1 `emits` vocabulary — never `decision`.
- `humanDecision` — `pending` until a person decides *outside* the platform. When
  `recorded`, it must name a human (`decidedBy`) and link the
  `resultingKnowledgeEvent` that carries the outcome back into learning.

## Why this was worth reopening a frozen contract

Adding `outputClass = decision_support` would have treated a *category error* as a
labelling problem. The Decision Boundary fixes the category: it draws a permanent
line between **a system that produces insight** and **a human who bears
responsibility for the decision.** That line will govern every future engine —
which is why it justified the one deliberate reopening of v1.0 → v1.1, and why it
is more valuable than any enum addition.

## Governing statements (normative)

- No engine may emit a Decision. (`emits` vocabulary; structurally enforced.)
- A Decision Workspace assembles emissions; it never decides.
- The Human Decision exists outside the Engine Platform.
- Only the *result* of a decision (a Knowledge Event) re-enters the system.
