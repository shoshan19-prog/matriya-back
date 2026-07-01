# Knowledge Event Engine — Contract v0.2 Stress Test

Second engine on paper. Where IKL Search proved the contract fits a **pure,
retrieval, read-only, semantic-similarity** engine, the Knowledge Event Engine
(KEE) tests the opposite corner: **stateless-but-stateful, causal,
evidence-based, appends a ledger.** This is where a naïve I/O-only contract — and
a Composer built on it — would break.

**Docs only. No runtime code, no Composer, no endpoints, no schema migration.**
The engine *declares* its state change; it does not implement it.

> **Updated for contract v0.3.** This stress test drove F1 (reasoning class) and
> F2 (retry/idempotency), both now **applied**. The instance declares
> `reasoning.class: evidential` (not the old `causal` proxy) and
> `retrySafe: true` with `idempotencyKey: hash(claim + sorted(sourceIds) +
> evidenceType)`. See `EngineContract.md` → "v0.3 changes".

Instance: [`KnowledgeEventEngine.contract.json`](./KnowledgeEventEngine.contract.json)
(validated against `engine-contract.schema.json`).

## 1. The headline result — statelessness ≠ purity

The second engine forced a clarification the first didn't need:

| | `stateless` | `purity` | `sideEffects` | `changes` |
|--|--|--|--|--|
| **ikl-search** | true | pure | read | `[]` |
| **knowledge-event** | true | **stateful** | **write** | **`[ledger append]`** |

Both engines are `stateless: true` — each call is independent and the engine
holds no memory of prior calls. **Statelessness (no memory) is orthogonal to
purity (no effects).** KEE is a stateless *function* with an *effect*. The
contract already separates these via `purity`/`changes`, so it expressed the
distinction without change. This is the single most important thing the second
engine validated.

## 2. Mapping: Evidence → Knowledge Event

```
ikl.Evidence@1                       ikl.KnowledgeEvent@1
  claim ....................DERIVES..> claim
  subject .................CARRIES...> subject
  sources[] (>=1, required)..QUALIFY..> evidenceRefs[] (carried, never dropped)
  evidenceType ............WEIGHS....> confidence (provenance_weighted_evidence)
                                       confidenceType = independent_evidence
                                       reasoningClass, reasoningTrace
                                       validationStatus = "pending"  (always)
                                       deltaK (optional)
                           APPEND....> knowledge-ledger  (the state change)
```

Two outputs from one call, and the contract keeps them distinct:
- **`produces`** = the `KnowledgeEvent` returned to the caller (data).
- **`changes`** = the append to the `knowledge-ledger` (effect).

A pure engine (Search) had `produces` and empty `changes`. KEE exercises both —
proving `produces` (what you get back) and `changes` (what you mutate) are
correctly separate concepts.

## 3. Declared state change (deliverable 3)

```json
"changes": [{ "target": "knowledge-ledger", "effect": "append", "domain": "hypothesis" }]
```

- **Append-only** (`effect: append`) — upholds Principle 2 (knowledge is never
  overwritten).
- **Domain `hypothesis`** — the event is appended as an **unvalidated ΔK
  candidate**, never as validated knowledge. `validationStatus` starts `pending`;
  promotion is a separate human-gated step (Principle 4). `domainSeparation.writes
  = ["hypothesis"]` — the engine can *read* internal+external evidence but may
  only *write* to the hypothesis domain, so it can never overwrite validated
  internal knowledge (Principle 5).
- **Atomic** — `E_LEDGER_UNAVAILABLE` states produce+append is all-or-nothing;
  the engine must not return an event as if it were appended.

## 4. Reasoning Signature (deliverable 4)

```json
"reasoning": {
  "class": "causal",
  "confidenceType": "independent_evidence",
  "emitsTrace": true,
  "evidenceModel": "independent sources counted, weighted by source tier"
}
```

The decisive contrast with Search: **same number, different meaning.**

| | ikl-search 0.81 | knowledge-event 0.81 |
|--|--|--|
| `confidenceType` | `semantic_similarity` | `independent_evidence` |
| means | "this record is semantically close" | "≥N independent, well-sourced evidences agree" |
| a Composer must… | not treat these as the same quantity; **never average across confidenceTypes** |

This is exactly the failure the Reasoning Signature was added to prevent, and the
KEE makes it concrete.

## 5. Capability Vector (deliverable 5)

```
observe ★★★☆☆   explain ★★★☆☆   predict ★☆☆☆☆
recommend ☆☆☆☆☆  generate ★★★★☆  validate ★★★★☆  learn ★★★★★
```

Near-mirror image of Search (`observe 5`, everything else ~0). KEE is a
**learn/validate/generate** engine, not a locator. A capability-driven Composer
would pick Search to *find* and KEE to *learn* — by capability, never by name.

## 6. Gap list — against current MATRIYA implementation

What the codebase lacks to actually run this engine (all additive; nothing here
is being built now):

- **KG1 — No Knowledge Ledger.** No append-only store of Knowledge Events exists.
  Closest primitives: `ikl_record_history` (append-only field-change log) and the
  `experiments` table (lab data) — neither is a qualified-event ledger.
- **KG2 — No `KnowledgeEvent` / `Evidence` types.** `ikl.Evidence@1` and
  `ikl.KnowledgeEvent@1` are not defined anywhere in code.
- **KG3 — No evidence-qualification logic.** Nothing computes event confidence
  from independent-evidence count × source tier. The Confidence Engine (II.1) that
  supplies the rubric is itself unbuilt.
- **KG4 — Provenance exists, Evidence doesn't.** `ikl_sources` gives per-record
  provenance (good), but there is no uniform "Evidence" object binding a claim to
  ≥1 source with an `evidenceType`.
- **KG5 — No atomic produce+append.** No transactional "append event to ledger"
  operation, hence no atomicity/idempotency guarantee for the effect.
- **KG6 — No hypothesis→validated promotion path.** `ikl_connections` models a
  hypothesis→validated lifecycle for one relationship type, but there is no
  general human-gated promotion of ledger events to validated knowledge.

## 7. Contract-level findings (what the second engine revealed about the contract)

These are **contract** gaps, not implementation gaps — candidates for **v0.3**.
Per the rules (no schema migration), they are recorded, not applied:

- **F1 — `reasoning.class` lacks an `evidential` / `qualification` value.** KEE's
  reasoning is evidence qualification; `causal` is the closest enum member and is
  used as a proxy. v0.3 should add `evidential` (and likely `inductive`).
- **F2 — stateful engines need retry/idempotency semantics.** v0.2's EngineContract
  notes "pure engines can be retried/parallelised freely; stateful ones cannot",
  but the manifest has no field to declare it. A stateful engine should declare
  something like `idempotencyKey`/`retrySafe` so the Composer knows a retry won't
  duplicate a ledger event. Add in v0.3.
- **F3 (minor) — multi-output effects.** KEE both `produces` and `changes`; the
  contract handled it, but v0.3 could make explicit that a produced artifact and a
  state change may be the *same* logical thing recorded in two places (the event
  returned == the event appended).

## 8. Verdict — does the contract describe both worlds?

**Yes.** Contract v0.2 described a pure retrieval engine (Search) and a stateful,
causal, evidence-producing engine (KEE) using the *same* manifest, and the
dimensions added in v0.2 are exactly what tells them apart:

| dimension | ikl-search | knowledge-event |
|--|--|--|
| purity / changes | pure / — | stateful / ledger append |
| reasoning.class | retrieval | causal (→ evidential, F1) |
| confidenceType | semantic_similarity | independent_evidence |
| capabilities | observe-heavy | learn/validate/generate-heavy |
| writes domain | none | hypothesis (never validated) |

The contract is now demonstrably **general across the pure↔stateful and
retrieval↔causal axes**, with two clean v0.3 refinements (F1, F2) and one
clarified semantic (stateless ≠ pure). It is *not* yet proven against a
`generative` engine (e.g. Combination Discovery / Virtual Formulation) — that
would be the natural third test.

**Implementation remains deferred.** No `runSearch()`, no ledger, no endpoints.
The contract earns the right to a third paper test or, on approval, the first
pure-function extraction — not before.
