# MATRIYA Engine Contract — v1.1 (STABLE)

> **v1.1 — the one deliberate reopening, for the Decision Boundary.** A *Decision
> is never an engine output.* Every engine now declares `outputEpistemics.emits`
> from a closed vocabulary (`observation · evidence · explanation · prediction ·
> candidate · recommendation · trade_off · risk · confidence · missing_evidence`)
> that **omits `decision`** — so no engine can ever declare it emits one. The
> Human Decision lives on a separate **Decision Workspace**
> ([`../task-contract/DecisionWorkspace.md`](../task-contract/DecisionWorkspace.md)),
> outside the Engine Platform; only the *result* of a decision re-enters as a
> Knowledge Event. This resolves RG3 more deeply than an enum addition — it fixes a
> category error, not a label — and governs every future engine. All four engine
> instances re-validate; none can emit a decision.

> **Above this layer:** the Scientific Task Model
> ([`../task-contract/ScientificTaskModel.md`](../task-contract/ScientificTaskModel.md))
> — Capability Ontology v1.0 + Scientific Task Contract v1.0 — describes *what the
> user wants* in capability terms, so a Composer plans by capability, never by
> engine name. Its 7 primitive capabilities are exactly this contract's capability
> vector axes.


> **v1.0 is stamped and frozen.** It has been stress-tested against all three
> reasoning modes (retrieval / evidential / generative) and refuses to weaken its
> epistemic boundaries. Future engines conform to this standard rather than the
> reverse. The next step is the first implementation (G7 `runSearch(input, ctx)
> → Result`) — deferred until explicitly approved; **nothing is built yet.**
>
> **v1.0 = v0.3 + two final decisions:**
> - **D1 `change.recordsProducedArtifact`** — the produced artifact and the
>   appended artifact may be the same logical thing (Knowledge Event returns *and*
>   appends the event). The Composer is told the append is not a hidden second output.
> - **D2 `reproducibility`** — a `deterministic: false` engine MUST declare whether
>   a seed makes runs repeatable (schema-enforced). Combination Discovery is now
>   seedable (`constraints.seed`); Search/Knowledge Event declare `seeded: false`.

> **Governing rule.** *The contract does not weaken to fit an engine.* If an
> engine cannot be represented without relaxing a safety boundary, that is a
> **contract failure to report — not an engine to force in.** In particular:
> **a generated candidate = a hypothesis awaiting validation — never knowledge,
> never a recommendation.** v0.3 encodes this as schema rules, so a manifest that
> tries to present invented output as fact *fails validation* (verified by a
> negative test against all three tamperings).



**Status:** documentation-only draft. **No runtime code, no `runSearch()`, no
Composer, no orchestration, no refactor of existing Search.** This defines *what
it means for an engine to be plug-and-play* and is validated against one real
engine (IKL Search) as a test case — see `SearchEngine.contract.json` and
`SearchEngine-mapping.md`.

> **v0.2 changelog.** v0.1 described an engine's *I/O* (consumes/produces,
> confidence/cost/latency/dependencies/failure modes) but not the **quality of
> its thinking**. Two engines can both report `confidence: 0.81` and mean utterly
> different things (semantic similarity vs. three independent causal evidences).
> v0.2 adds four dimensions so the Composer routes by *meaning and behaviour*,
> not just by shape:
> **(1) Reasoning Signature — what the confidence means; (2) State Changes — does
> it change the world or only read it; (3) Capability Vector — which cognitive
> capabilities it provides; (4) Transformation — define an engine by what it
> transforms, not by what it is.** Implementation is deferred until the contract
> carries these — an I/O-only contract would let the Composer be built blind to
> meaning.

> Why this first, and not the Composer: if the one engine we already shipped
> cannot enter the contract cleanly, the whole Plug & Play idea is broken. So we
> test the contract against reality **before** building anything on top of it.
> If Search doesn't fit, we fix the *contract*, not Search.

## What the contract is (and is not)

- **Is:** a self-describing *manifest* every engine publishes — its identity,
  typed inputs/outputs, and its confidence/cost/latency/dependencies/failure
  modes. A machine can read it and decide "can this be wired to that?".
- **Is not:** an executor, a scheduler, or a manager. Nothing here calls an
  engine. Composition is a *later* concern; the contract must exist first.

Formal schema: [`engine-contract.schema.json`](./engine-contract.schema.json)
(JSON Schema 2020-12).

## The five conformance rules (from the brief)

1. **Stateless.** An engine is `Input → Output`. It retains no per-call state and
   knows nothing about its caller or what runs next. (Connection pools and model
   caches are infrastructure, not engine state.)
2. **Declares `consumes` / `produces`.** Every input and output is a *named type*
   (e.g. `ikl.SearchQuery@1`, `ikl.SearchResultSet@1`).
3. **Exposes confidence, cost, latency, dependencies, failure modes.**
4. **Typed and composable output.** Output is delivered in a standard envelope so
   a producer's `produces[].type` can later be matched to a consumer's
   `consumes[].type`.
5. **No hidden coupling.** An engine never imports another engine. Dependencies
   are data stores / indexes / models / host services only.

## Manifest fields (summary)

| Field | Meaning |
|-------|---------|
| `apiVersion` | Pins the manifest to a contract revision (`engine-contract/v1.0`). |
| `name`, `version`, `purpose`, `category` | Identity. |
| `stateless` | MUST be `true`. |
| `deterministic` | If `false`, `reproducibility` is required (D2). |
| `purity` | `pure` / `stateful` — see State Changes below. |
| `sideEffects` | `none` / `read` / `write`. |
| `changes[]` | Shared state the engine mutates (empty = pure); `recordsProducedArtifact` marks produced==appended (D1). |
| `retrySafe`, `idempotencyKey` | (F2). Retry safety; stateful+retrySafe requires a dedup key. |
| `reproducibility` | (D2). `{ seeded, seedParam }` for non-deterministic engines. |
| `outputEpistemics` | (F3). Hypothesis safety envelope — `outputClass`, `neverAssertsAs`, `validationGating`. |
| `transformation` | The Input→Output transformation the engine *is*. |
| `consumes[]`, `produces[]` | Typed ports (`type`, `cardinality`, `schema`/`schemaRef`, `required`). |
| `reasoning` | Reasoning Signature — what the confidence *means*. |
| `confidence` | `emits`, `scale`, `granularity`, `method`, `calibrated`. |
| `capabilities` | Capability Vector — observe/explain/predict/recommend/generate/validate/learn (0..5). |
| `cost` | `model` (relative/absolute), `unit`, `estimate`. |
| `latency` | `unit: ms`, `p50/p95/max` (may be null until measured). |
| `dependencies[]` | `name`, `kind` (datastore/index/model/service/config), `required`. |
| `failureModes[]` | Stable `code` (`E_*`), `condition`, `result`, `severity`, `recoverable`. |
| `provenance`, `domainSeparation` | Platform guarantees the engine upholds. |

## The four v0.2 dimensions (quality of thinking)

**1. Reasoning Signature (`reasoning` + runtime).** Confidence is never a bare
number. The manifest declares the reasoning `class` (retrieval / causal /
experimental / statistical / analogical / rule_based / generative / optimization
/ simulation) and the `confidenceType` (what the number is derived from). At
runtime the result envelope carries the full signature:

```jsonc
{
  "confidence": 0.81,
  "confidenceType": "semantic_similarity",   // vs "causal", "experimental", "statistical", ...
  "reasoningClass": "retrieval",
  "evidenceCount": 6,
  "independentSources": 3,
  "reasoningTrace": "…"                        // optional; emitsTrace declares if present
}
```

Same magnitude, different meaning: Search's `0.81` = "semantically close"; a
Patent engine's `0.81` = "three independent evidences agree". The Composer must
not average these as if they were the same quantity.

**2. State Changes (`purity` + `changes[]`).** Declares whether the engine
changes the world. `pure` (empty `changes`) vs `stateful`. Examples:

| Engine | Consumes | Produces | Changes |
|--------|----------|----------|---------|
| Search | Query | SearchResult | — (pure) |
| Knowledge Event | Evidence | KnowledgeEvent | knowledge-ledger (append) |
| Experiment Planner | Gaps | Plan | research-queue (enqueue) |

The Composer learns *who is pure and who is stateful* from the manifest, without
reading code — essential for safe planning (a pure engine can be retried/parallelised freely; a stateful one cannot).

**3. Capability Vector (`capabilities`).** Each engine rates itself 0..5 on
observe / explain / predict / recommend / generate / validate / learn. At 40–60
engines the Composer selects by *capability*, not by name — "I need something
that can *explain*, strongly" → pick by `explain ≥ 4`. This maps directly to the
researcher's loop **See → Understand → Predict → Decide** (observe→See,
explain→Understand, predict→Predict, recommend/validate→Decide).

**4. Transformation (`transformation`).** *An engine is defined not by what it is,
but by what it transforms.* Each engine declares `from → operation → to`
(`SearchQuery --rank_by_similarity--> SearchResultSet`). This reframes the whole
platform from "a collection of services" into "a collection of transformations" —
which is what makes composition meaningful.

## The composable result envelope (target shape)

`produces` payloads are the engine's *data*; every invocation returns that data
inside a common envelope so outputs compose uniformly. This is the **target**
shape — the current Search response does not emit it yet (gap G3):

```jsonc
{
  "engine": "ikl-search",
  "engineVersion": "0.1.0",
  "produces": "ikl.SearchResultSet@1",
  "status": "ok",                 // ok | empty | degraded | failed
  "data": { /* payload matching produces[].schema */ },
  "confidence": 0.71,             // set-level, 0..1, or null
  "reasoning": {                  // v0.2 — what the confidence MEANS
    "confidenceType": "semantic_similarity",
    "reasoningClass": "retrieval",
    "evidenceCount": 6,
    "independentSources": 3,
    "reasoningTrace": null
  },
  "provenance": [ /* source refs contributing to this output */ ],
  "metrics": { "latencyMs": 128, "cost": null },
  "warnings": [],
  "failure": null                 // or { "code": "E_...", "message": "..." }
}
```

Composition rule (for a future Composer, **not built here**): engine A can feed
engine B iff `A.produces[i].type === B.consumes[j].type`.

## How an engine "joins" the contract

An engine conforms through a **thin adapter**, never a rewrite:
1. Publish a manifest (a JSON file today; a `GET …/contract` endpoint later).
2. Wrap its core logic as a pure `run(input, context) → Result envelope`.
3. Map its errors to the enumerated `E_*` failure codes.

The core behaviour is untouched — conformance is *additive*.

## Success test

Looking at IKL Search through this contract, can we answer
**"Can this be a plug-and-play engine?"**

**Yes — conditionally.** Search maps onto the contract (including all four v0.2
dimensions) with a thin conformance adapter (manifest + result envelope + typed
error codes + reasoning signature) and **no change to its search behaviour**. The
specifics, and the exact gaps, are in
[`SearchEngine-mapping.md`](./SearchEngine-mapping.md).

Decision gate (per the brief's A.2 test): **implementation stays deferred.** We do
*not* write `runSearch()` yet. The contract now carries meaning and behaviour
(reasoning, changes, capabilities, transformation), not only I/O — that was the
precondition. The next step, on explicit approval only, is the pure-function
extraction (gap G7); the Composer comes after that. Had any gap required changing
what Search *does*, we would revise the contract first, not the engine.

## Test cases — three reasoning modes, one contract

The contract is validated on paper against three engines chosen to span the
extremes. All three validate against the *same, unchanged* schema:

| Engine | purity | reasoning | writes | file |
|--------|--------|-----------|--------|------|
| **Search** (1) | pure | retrieval | none | `SearchEngine.contract.json` |
| **Knowledge Event** | stateful | evidential | hypothesis | `KnowledgeEventEngine.contract.json` |
| **Combination Discovery** (16) | pure | generative | none | `CombinationDiscoveryEngine.contract.json` |
| **Recommendation** (3) | pure | optimization* | none (decision-support) | `RecommendationEngine.contract.json` |

\* Recommendation was demanded by the Capability Planner (a `recommend ≥3` gap in
a real task), not proposed. It fits frozen v1.0 and enforces *Recommendation ≠
Decision* in its payload, but surfaced **RG3**: the safety envelope has no
manifest-level `decision` boundary. See `RecommendationEngine-mapping.md` — the
first safety-relevant candidate for a post-freeze revision.

Each has a `*-mapping.md` with its Evidence/IO mapping, gap list and verdict.

Key results:
- **Statelessness ≠ purity.** Knowledge Event is `stateless: true` (no memory) yet
  `purity: stateful` (appends a ledger). The contract expressed this unchanged.
- **Same number, different meaning.** `confidence: 0.8` means semantic proximity
  (Search), agreement of independent evidence (Knowledge Event), or an untested
  mechanism-plausibility prior (Combination Discovery). The Reasoning Signature
  types this — a Composer must never average across `confidenceType`s.
- **Type-level safety.** The generative engine's honesty (candidates carry
  provenance + assumptions + required validation + `epistemicStatus =
  candidate_hypothesis`) is enforced in its `produces` schema — the type system
  doing safety.

## v0.3 changes (applied)

The three stress tests were folded into the schema in one deliberate revision.
All three instances re-validate against v0.3.

- **F1 — applied.** `reasoning.class` gains `evidential` and `inductive`. Knowledge
  Event now declares `evidential` (was the `causal` proxy).
- **F2 — applied.** New `retrySafe` (required) + `idempotencyKey`. A **schema rule**
  enforces: `purity: stateful` + `retrySafe: true` ⇒ `idempotencyKey` required.
  Knowledge Event declares `hash(claim + sorted(sourceIds) + evidenceType)`.
- **F3 — applied (the hypothesis safety envelope).** New top-level
  `outputEpistemics` (`outputClass`, `emitsUnvalidated`, `guarantees`,
  `neverAssertsAs`, `validationGating`), plus `mechanism_plausibility` /
  `predictive_estimate` `confidenceType`s (subsumes the old F4/F5). Three schema
  rules make the safety boundary structural:
  1. `reasoning.class: generative` ⇒ `outputClass: hypothesis` **and**
     `neverAssertsAs` ⊇ {`fact`, `recommendation`}.
  2. `outputClass: hypothesis` ⇒ `emitsUnvalidated: true`, `validationGating:
     human_gated`, and `guarantees` ⊇ {`provenance`}.
  3. (F2 rule above.)

**Verified:** a negative test tampered the generative manifest three ways —
declaring candidates `asserted`, dropping the fact/recommendation guard, and
self-validating — and **all three were rejected**. The contract reports the
failure; it does not absorb it.

### Resolved at v1.0 (both prior deferrals decided)

- **D1** (was F3-orig) — `change.recordsProducedArtifact` marks when the appended
  artifact *is* the produced one. Applied to Knowledge Event.
- **D2** (was F6) — `reproducibility { seeded, seedParam }`, required whenever
  `deterministic: false` (schema rule). Combination Discovery is seedable via
  `constraints.seed`; Search and Knowledge Event declare `seeded: false`.

**Status: v1.0 stamped & frozen.** Exercised across retrieval / evidential /
generative, hardened for safety, and the two open decisions are made. The
standard is stable; new engines conform to it. Implementation stays deferred —
nothing is built; no `runSearch()`. The next engineering step, on approval, is
**G7**: extract a pure `runSearch(input, ctx) → Result` so Search becomes the
first engine that actually *runs* under the contract.
