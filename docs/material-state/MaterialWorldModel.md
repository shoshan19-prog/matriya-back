# MATRIYA Material World Model v1.0 (on paper)

**Status: standard locked (docs only). No runtime code, no simulation, no engine
execution.**

This is the shift from *a system that retrieves information* to *a system that
models how a material behaves*. Today knowledge flows `Documents → Embeddings →
Graph`. Chemistry does not: it is a **world model** in which materials exist
inside a **State Space**, and documents/patents/TGA/DSC/FTIR/experiments are only
**evidence that updates that model**.

## The principle

> **Everything in chemistry is a state transition.** A material is defined not
> only by its composition, but by (1) which **state** it is in, (2) what
> **driver** moves it to another state, and (3) the **result** of that transition.

A chemist hearing "800 °C" does not think `temperature = 800`; they think
`Energy → bond dissociation → phase transition → volatile release → oxidation →
char → morphology → mechanical properties`. That chain is the model.

## The discipline: define the world before the engine

The same rule that carried the whole project — **contract before engine,
capability before composer, task before execution** — applies here. You cannot
build a consistent simulation engine while the concept of *State* is undefined;
that is a structural dependency, not a preference. So this standard is delivered
in strict dependency order:

1. **Material World Model Ontology v1.0** — the entities and relations
   ([`material-world-model.ontology.json`](./material-world-model.ontology.json)).
   *What a State, Transition, Driver, Mechanism, Interface, Evidence, Constraint
   and Law ARE, and how they relate.* Comes first.
2. **Material State Schema v1.0** — the formal representation of `State` and
   `Transition` ([`material-state.schema.json`](./material-state.schema.json),
   with the worked example [`material-state.example.json`](./material-state.example.json)).
3. **Material Transformation Engine Contract** — the first engine that *acts* on
   the model ([`../engine-contract/MaterialTransformationEngine.contract.json`](../engine-contract/MaterialTransformationEngine.contract.json)).
   Comes last, and depends structurally on 1 and 2.

## 1. Ontology — the entities

`State` (material · phase · microstructure · composition · interfaces ·
energy_state · environment · time · properties · confidence · provenance) ·
`Transition` (from_state · driver · mechanism · activation_threshold ·
transition_rate · reversible · energy · evidence · confidence · to_state) ·
`Driver` (temperature/humidity/pressure/radiation/uv/electric_field/
mechanical_stress/ph/time) · `Mechanism` (→ IKL Layer 4) · `Interface` (→ Engine
20/30) · `Property` · `Evidence` (→ ikl_sources; *updates* the model, is not the
model) · `Constraint` (→ Constraint Physics) · `Law` (a Transition validated into
a general rule). Governance: provenance required, predictions are hypotheses,
separation preserved, Transition→Law only via human-gated validation (FSCTM).

## 2. State Schema — a graph of sourced transitions

Nodes are states; edges are transitions carrying `{ driver, threshold, mechanism,
rate, reversibility, energy, resultingProperties, evidence(≥1), confidence }`.
Every state and every transition is provenance-bound — **no invented chemistry**.
The worked example (epoxy: glassy → rubbery → thermal-degradation → carbonized) is
flagged *illustrative* with placeholder provenance and low confidence, pending
real TDS/DSC/TGA sources.

## 3. Transformation Engine — inference, not retrieval

`material-transformation` (Engine Contract **v1.1**, `reasoning.class:
simulation`, `predict = 5`) traverses the State Space:
`Current State + Driver → transition graph → predicted cascade`. It **emits
`prediction`/`explanation`** — never a decision — as **hypotheses** with per-step
provenance; cascade confidence is the weakest link along the path. When there is
**no known transition** for a `(state, driver)`, it returns an empty cascade with
`terminatedReason: no_further_transition` — the **FSCTM breakdown trigger**
(a gap fed to Innovation Space), never an invented path.

It fits the frozen contract **unchanged**, and its `predict = 5` capability is a
new profile no existing engine had — so, like the Recommendation Engine before it,
it also closes a capability-coverage gap.

## What this changes

**IKL becomes dynamic.** `Material → Property` becomes `Material → State →
Transition → Property`.

**Every engine re-grounds on the model, not on documents:**
- Recommendation recommends a **transition path**, not just a product.
- Combination Discovery builds a **new transformation path**.
- Patent searches for a **transition that does not yet exist**.
- Knowledge Event stores an **observed transition** (`State A + Energy → State B`),
  not "experiment succeeded" — and feeds it back into the model.

## The loop — the physics core

```
Knowledge Sources (evidence)
        ↓
Material World Model  ← the representation everything runs on
        ↓
Transformation Engine
        ↓
Scientific Engines
        ↓
Decision Workspace
        ↓
Human Decision
        ↓
Knowledge Event ──────────────► Material World Model (updated)
```

Documents, patents, TGA/DSC/FTIR and experiments are the *evidence* that keeps the
model current; the engines reason over the model; the human decides; the decision
becomes a Knowledge Event that updates the model. MATRIYA stops being an
industrial *knowledge* system and becomes a **computational model of material
behaviour** — a bigger change than adding ten engines, because it changes the
representation every engine stands on.

**Nothing here is implemented.** The next step, on approval, is populating the
State Space from real sourced evidence (an ingestion concern) — not code around a
representation that might still be incomplete.
