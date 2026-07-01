# MATRIYA Engine Contract — DRAFT v0.1

**Status:** documentation-only draft. **No runtime code, no Composer, no
orchestration, no refactor of existing Search.** This defines *what it means for
an engine to be plug-and-play* and is validated against one real engine
(IKL Search) as a test case — see `SearchEngine.contract.json` and
`SearchEngine-mapping.md`.

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
| `apiVersion` | Pins the manifest to a contract revision (`engine-contract/v0.1`). |
| `name`, `version`, `purpose`, `category` | Identity. |
| `stateless` | MUST be `true`. |
| `sideEffects` | `none` / `read` / `write`. |
| `consumes[]`, `produces[]` | Typed ports (`type`, `cardinality`, `schema`/`schemaRef`, `required`). |
| `confidence` | `emits`, `scale`, `granularity`, `method`, `calibrated`. |
| `cost` | `model` (relative/absolute), `unit`, `estimate`. |
| `latency` | `unit: ms`, `p50/p95/max` (may be null until measured). |
| `dependencies[]` | `name`, `kind` (datastore/index/model/service/config), `required`. |
| `failureModes[]` | Stable `code` (`E_*`), `condition`, `result`, `severity`, `recoverable`. |
| `provenance`, `domainSeparation` | Platform guarantees the engine upholds. |

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

**Yes — conditionally.** Search maps onto the contract with a thin conformance
adapter (manifest + result envelope + typed error codes + confidence labelling)
and **no change to its search behaviour**. The specifics, and the exact gaps,
are in [`SearchEngine-mapping.md`](./SearchEngine-mapping.md).

Decision gate (per the brief's A.2 test): proceed to design the Composer **only
because** a real engine fit the contract with additive-only gaps. Had the gaps
required changing what Search *does*, we would revise the contract first.
