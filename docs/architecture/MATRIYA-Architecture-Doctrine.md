# MATRIYA — Architecture Doctrine

**Status: doctrine (documentation of an existing pattern). No new capability.**

The most important thing built in the last weeks is not the Router, the Executor,
or the MBM. It is a **repeatable architectural pattern** — a grammar every new
component now follows. This document codifies it so the consistency is preserved as
the system grows.

## The recurring build cycle (Template)

```
Knowledge / Model
      ↓
Formal Contract         (schema / standard — the authority definition)
      ↓
Authority Boundary      (who may do what; what is forbidden)
      ↓
Executor                (runs a plan through injected layers — DI)
      ↓
Runtime Enforcement     (the boundary is re-checked at run time)
      ↓
Verification Suite      (boundary tests that BITE; negative tests)
      ↓
Production Adapter       (last — lazy, real data, human-in-the-loop)
```

This is a **template**, not a one-off. It produced both the **MBM** (Stage A→C:
ontology → invariants/contracts → reliability boundaries → engines → suites) and
the **KRL router** (contract → boundary → executor → runtime guard → 4-group
suite → lazy ragService adapter).

## The three architecture laws (codified)

### LAW-ARCH-001 — Contract Before Capability
A new capability does not enter the system before it has an explicit contract.
```
Model → Contract → Capability        (never Capability → Contract)
```
Evidence: Engine Contract v1.1 before any engine; Failure Case schema before the
corpus; KRL boundary contract before the executor.

### LAW-ARCH-002 — Enforcement Before Integration
Before a new subsystem is wired to production there must be at least one
**enforcement** layer. A contract alone is insufficient — there must be a runtime
guard.
```
Contract  (necessary)   +   Runtime Guard  (required before integration)
```
Evidence: LAW-KRL-BOUNDARY-001 enforced twice (router refuses to *produce* a
violation; executor refuses to *run* one); MBM invariants gate every transition;
G1–G6 gate the first flight.

### LAW-ARCH-003 — Adapter Last
The production adapter is always the last component written.
```
Model → Tests → Executor → Adapter        (never API → Model)
```
Evidence: G7 `runSearch(input, ctx)` and the KRL `retrievalFromRagService()` are
lazy adapters written after the contract + tests; real ingestion is designed but
deliberately unbuilt until the pipeline (G1–G6) exists.

## Why this matters

MATRIYA is shifting from "a collection of engines" to **a system with one internal
grammar**: define authority first, implement capability second. That is a deeper
architectural change than adding features — it means new components can be built to
the same structure (contracts, boundaries, enforcement, tests) without losing
consistency over time.

## Strategic scopes (future — not now)

Each opens as its own scope, with its own contract first (LAW-ARCH-001):

1. **Authority Kernel** — extract the shared authority machinery (Contracts ·
   Boundaries · Executors · Runtime Guards · Trace · Metrics) into one library that
   MBM, KRL, and future engines reuse.
2. **Scientific Workflow Engine** — run a full research cycle end to end:
   `Question → Hypotheses → Competing Mechanisms → Experiments → Evidence → ΔK →
   Knowledge → Law`. Manage the cycle, not just compute steps.
3. **Knowledge Operating System** — the convergence point of Query Engine, MBM,
   KRL, Knowledge Events, Evolution Engine, and Research Memory into one OS for
   knowledge: `Input → Evidence → Reasoning → Knowledge Evolution → Decision
   Support`.

And the three governance add-ons already noted for the next KRL scope: **Authority
Trace** (return the full decision path per answer), **Capability Registry** (engines
register capabilities; the router selects by capability, not by engine name), and
**Authority Metrics** (measure violations / corrections / hybrid-rate /
clarification-rate / rejects).

## The rule of thumb

> Define authority first. Implement capability second. Never merge without an
> enforcement layer. Write the adapter last.
