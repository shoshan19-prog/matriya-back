# Combination Discovery / Virtual Formulation — Contract v0.2 Stress Test

Third engine on paper, and the riskiest reasoning mode: **generative.** Where
Search *retrieves* and the Knowledge Event Engine *qualifies*, this engine
**invents** — it creates candidate formulations that have never been tested. It
is precisely where "never present a hypothesis as a fact" (Principle 7 / 4) is
most likely to break.

**Docs only. No runtime code, no Composer, no endpoints, no schema migration.**

Instance:
[`CombinationDiscoveryEngine.contract.json`](./CombinationDiscoveryEngine.contract.json)
(validated against `engine-contract.schema.json`).

> **Updated for contract v0.3.** This stress test drove F3 — the hypothesis
> safety envelope — now **applied**. The instance declares `confidenceType:
> mechanism_plausibility` (not the old `model_probability` proxy) and an
> `outputEpistemics` block; schema rules now force any generative engine's
> outputs to be `hypothesis` / human-gated and forbid `fact`+`recommendation`
> assertion. A negative test confirms tampered manifests are rejected. See
> `EngineContract.md` → "v0.3 changes".

## 1. The three engines side by side

| dimension | ikl-search | knowledge-event | combination-discovery |
|--|--|--|--|
| reasoning.class | retrieval | causal | **generative** |
| purity / changes | pure / — | stateful / ledger append | **pure / —** |
| writes | none | hypothesis | **none** |
| confidenceType | semantic_similarity | independent_evidence | model_probability *(proxy — F4)* |
| what confidence means | "semantically close" | "N independent evidences agree" | **"mechanism-plausible, untested"** |
| capabilities peak | observe 5 | learn 5 | **generate 5** |
| output epistemics | facts (sourced records) | unvalidated event | **candidate hypothesis + assumptions + missing validation** |

Three reasoning modes, three purity/effect profiles — **one manifest, unchanged.**

## 2. Mapping: Requirements + Constraints + Knowledge Base → Candidates

```
ikl.FormulationRequirements@1 ┐
ikl.FormulationConstraints@1  ┼─ generate_mechanism_constrained_candidates ─► ikl.CandidateSet@1
Knowledge Base (dependency) ──┘                                                 candidates[] (each a hypothesis)
```

A modeling point the generative engine surfaced: **its "input" is partly
ambient.** Requirements + Constraints are the per-call typed `consumes`; the
Knowledge Base (mechanisms, compatibility, raw materials, performance, failures)
is read as **dependencies**, not passed each call. The contract handled this
cleanly — `consumes` for the request, `dependencies` for the ambient KB — but it
is worth noting that a generative engine consumes *goals*, not *records*.

Per candidate produced: `formulation` (materials+fractions, each tagged
external/internal domain), `predicted` properties **with uncertainty**,
`mechanismRationale` (the trace), a `ranking` breakdown (compatibility ·
mechanism · risk · confidence · performance · cost · novelty), and the mandatory
honesty fields in §4.

## 3. Declared state changes (deliverable 3)

```json
"purity": "pure", "sideEffects": "read", "changes": [], "domainSeparation": { "writes": ["none"] }
```

- **No validated-knowledge writes.** The engine writes nothing — it returns
  candidates. `changes: []`, `writes: ["none"]`.
- **Outputs are hypothesis/candidate only.** Enforced structurally: every
  candidate's `epistemicStatus` is a `const: "candidate_hypothesis"` — it is
  impossible to emit a candidate marked as fact.
- **Reads both domains, blends into a hypothesis.** `reads: ["external",
  "internal"]` — it may combine external IKL data with internal Fresco know-how
  (the "Fresco DNA" advantage), but the *result is a hypothesis*, and each
  material carries its `domain`, so nothing internal is silently exported as
  external (Principle 5 holds).

## 4. Reasoning Signature (deliverable 4)

```json
"reasoning": { "class": "generative", "confidenceType": "model_probability", "emitsTrace": true,
  "evidenceModel": "mechanism-constrained plausibility; no candidate is tested" }
```

The crucial property: this engine's confidence is a **plausibility prior, not a
probability of success.** A `0.7` here is epistemically *weaker* than Search's
`0.7` (semantic) and far weaker than a lab result. It is *uncertainty-aware*:
every predicted property carries an explicit `uncertainty`, never a point claim.
`model_probability` is used as the closest enum value but is a poor fit — see F4.

## 5. Capability Vector (deliverable 5)

```
observe ★★☆☆☆  explain ★★★☆☆  predict ★★★☆☆  recommend ★★☆☆☆
generate ★★★★★  validate ☆☆☆☆☆  learn ★☆☆☆☆
```

`generate 5, validate 0` — the mirror of the Knowledge Event Engine
(`validate 4, generate 4`). A capability-driven Composer would deliberately pair
them: **generate with combination-discovery, then validate with a different
engine** — it must *never* let the generator validate its own output.

## 6. Safety rules (deliverable 6) — encoded, not just stated

The safety requirements are enforced **at the type level**, in the `produces`
schema, so they cannot be bypassed. Every candidate REQUIRES:

| Safety rule | How it is enforced |
|-------------|--------------------|
| Never present a candidate as fact | `epistemicStatus` = `const "candidate_hypothesis"` |
| Expose provenance | `provenance` array, `minItems: 1` (the KB facts it was built from) |
| Expose assumptions | `assumptions` array, `minItems: 1` |
| Expose confidence type | `confidence` + `confidenceType` required; typed as plausibility |
| Expose missing validation | `validationRequirements` array, `minItems: 1` (what experiment confirms it) → feeds Engine 23 |
| Don't hide uncertainty | `predicted[].uncertainty` required per property |
| Don't claim exhaustiveness | `generationBounds.truncated` required |

A candidate lacking any of these is structurally invalid — the engine literally
cannot emit an unqualified claim. **This is the type system doing safety.**

## 7. Gap list — against contract v0.2 (deliverable 7)

The generative engine fit v0.2 unchanged, but revealed real refinements. All are
**contract-level v0.3 candidates — recorded, not applied** (no schema migration):

- **F4 (new) — `confidenceType` lacks a generative/plausibility value.** A
  generated candidate's confidence is a *mechanism-plausibility prior*, not a
  `model_probability`. v0.3 should add e.g. `mechanism_plausibility` (and likely
  `predictive_estimate`) so the Composer never conflates a plausibility with a
  measured probability.
- **F5 (new) — no first-class output epistemics.** Safety here rides entirely in
  the payload schema (`epistemicStatus`, `assumptions`, `validationRequirements`).
  The *manifest* has no top-level declaration that "this engine's outputs are
  unvalidated hypotheses carrying assumptions + required validation." v0.3 should
  add an `outputEpistemics` block so a Composer knows an engine is generative-
  unsafe **without parsing its payload schema**.
- **F6 (new) — no generation-bounds / reproducibility declaration.** Generative
  (and search) engines need to declare bounds (max candidates, search strategy)
  and a reproducibility seed, since `deterministic: false` + sampling means
  results aren't repeatable without one. v0.2 has `cost` but no bounds/seed field.
- Carried from earlier: **F1** (`reasoning.class` needs `evidential`/`inductive`),
  **F2** (stateful engines need retry/idempotency).

## 8. Verdict — the success question

**Can one Engine Contract describe pure retrieval, stateful knowledge append, AND
generative hypothesis creation — without changing the contract?**

**Yes.** All three instances validate against the *same* unchanged
`engine-contract.schema.json` (v0.2):

- `ikl-search` — pure · retrieval · read · semantic_similarity
- `knowledge-event` — stateless-but-stateful · causal · appends ledger · independent_evidence
- `combination-discovery` — pure · generative · writes nothing · plausibility prior

The contract is now demonstrably general across the **pure↔stateful** and
**retrieval↔causal↔generative** axes. The dimensions added in v0.2 (purity,
changes, reasoning, capabilities, transformation) are exactly what distinguishes
the three, and the type-level `produces` schema is strong enough to enforce
generative safety.

The generative engine — the most dangerous type — surfaced three v0.3 refinements
(F4, F5, F6) that are all about **epistemic honesty**, which is fitting: the place
a contract most needs to be strict is the engine that invents. None require
changing v0.2's structure; they enrich it.

**Recommendation:** the contract has now been stress-tested against all three
reasoning modes. This is the natural point to **freeze v0.2 and cut Engine
Contract v1.0**, folding in F1–F6 as the deliberate, one-time set of refinements —
rather than versioning piecemeal. Implementation stays deferred until then.
Nothing here is implemented.
