# IKL Search → Engine Contract — Mapping & Gap List

Maps the **already-shipped** `POST /ikl/search` (in `iklEndpoints.js`, over
`iklVectorStore.js`) onto the Engine Contract, and lists exactly what it lacks to
fully comply. **No runtime change is proposed or made here.**

Reference: handler at `iklEndpoints.js` `router.post('/search', …)`; returns
`{ query, total, items:[{ layer, score, snippet, record }] }`.

## 1. Mapping — current behaviour → contract

| Contract element | Current Search reality | Fit |
|------------------|------------------------|-----|
| `name` / `version` | none published; identity is implicit in the route | ⚠ add manifest (G1) |
| `stateless` | ✔ read-only; no per-request state (module-level `dbReady` + vector-store singleton are infra caches) | ✔ |
| `sideEffects: read` | ✔ search reads only (auto-indexing lives on *write* routes, not here) | ✔ |
| `consumes: ikl.SearchQuery@1` | `req.body.{query|q, layer?, limit?}`; `limit` clamped ≤100; unknown layer rejected | ✔ (untyped) |
| `produces: ikl.SearchResultSet@1` | `{ query, total, items:[{layer, score, snippet, record}] }` | ⚠ untyped + no envelope (G3, G4) |
| `confidence` (0..1, item, cosine) | per-item `score = 1 - cosine_distance` | ⚠ raw, uncalibrated, unlabelled (G2) |
| `cost` | not measured/emitted | ⚠ (G5) |
| `latency` | not measured/emitted | ⚠ (G5) |
| `dependencies` | `ikl_embeddings`, embedding model, pg+pgvector, IKL tables (hydration) — all real, just undeclared | ✔ once declared |
| `failureModes` | ad-hoc `{error}` + HTTP 400/500/503 | ⚠ untyped codes (G6) |
| `provenance` | ✔ each `record.source` = `ikl_sources` row | ✔ (item level; G3 for envelope) |
| `domainSeparation: reads external` | ✔ IKL is external-only; `ikl_embeddings` is separate from Fresco `rag_documents` | ✔ |
| **`purity: pure` / `changes: []`** (v0.2) | ✔ search only reads | ✔ |
| **`transformation`** (v0.2) | ✔ `SearchQuery --rank_by_similarity--> SearchResultSet` | ✔ (declarable) |
| **`reasoning`** (v0.2) | class `retrieval`, confidenceType `semantic_similarity`; `score` = similarity | ✔ declarable; runtime `reasoningTrace`/`independentSources` not emitted (G8) |
| **`capabilities`** (v0.2) | observe 5, explain 1, rest 0 (a pure locator, not an explainer) | ✔ (declarable) |

**Field-by-field I/O mapping**

| Contract | Source in code |
|----------|----------------|
| `SearchQuery.query` | `req.body.query \|\| req.body.q` |
| `SearchQuery.layer` | `req.body.layer` (validated vs `IKL_LAYERS`) |
| `SearchQuery.limit` | `Math.min(parseInt(limit) \|\| 10, 100)` |
| `SearchResultSet.items[].layer` | `h.metadata.layer` |
| `SearchResultSet.items[].score` | `h.distance` (cosine similarity) |
| `SearchResultSet.items[].snippet` | `h.document` |
| `SearchResultSet.items[].record` | hydrated `IKL_LAYERS[layer].model` row incl. `source` |

## 2. Gap list — what Search lacks to fully comply

Every gap is **additive** — an adapter around Search, not a change to it.

- **G1 — No self-describing manifest.** Identity/consumes/produces aren't
  discoverable. *Fix (later):* ship `SearchEngine.contract.json`; optionally a
  read-only `GET /ikl/search/contract` that returns it.
- **G2 — Confidence is a raw score, not calibrated/labelled.** `score` is cosine
  similarity, exposed as an unlabelled number, with no set-level confidence.
  *Fix:* label it `method: cosine_similarity, calibrated: false`; optionally add a
  set-level confidence. No ranking change.
- **G3 — No standard result envelope.** Response lacks `engine`, `engineVersion`,
  `status`, envelope-level `provenance`, `metrics`, `warnings`, `failure`.
  *Fix:* wrap the existing body as `data` inside the envelope (additive).
- **G4 — Untyped I/O.** Input/output aren't tagged `ikl.SearchQuery@1` /
  `ikl.SearchResultSet@1`, which a Composer needs to wire ports. *Fix:* attach
  type ids in the envelope/manifest.
- **G5 — No cost/latency emission.** Contract can *declare* estimates (done, as
  null); runtime doesn't *measure* per call. *Fix:* record `latencyMs` into
  `metrics` (the existing `metrics.js` middleware already times routes).
- **G6 — Untyped failure modes.** Errors are `{error: "..."}` + HTTP codes, not
  stable `E_*` codes. *Fix:* map to `E_QUERY_REQUIRED`, `E_UNKNOWN_LAYER`,
  `E_INDEX_EMPTY`, `E_EMBED_UNAVAILABLE`, `E_DB_UNAVAILABLE`.
- **G7 — DONE.** Core search is now a pure `runSearch(input, ctx) → Result` in
  [`../../iklSearchEngine.js`](../../iklSearchEngine.js); the `/ikl/search` route
  is a thin adapter (`searchResultToLegacyResponse`) with **no behaviour change**.
  Dependencies (vector store / layers / source model) are injectable via `ctx`.
  The Result is the Engine Contract v1.1 envelope (`emits: [observation,
  evidence]` — never `decision`; `reasoning.confidenceType: semantic_similarity`).
  Proven by `scripts/test-run-search-g7.mjs` (legacy body byte-identical, `||`
  fallback + limit-clamp + error responses preserved, envelope conforms to the
  frozen manifest). *Remaining, still additive:* auth stays a host concern at the
  route (not inside the engine); G1/G2/G3/G6/G8 unchanged.
- **G8 — Reasoning Signature is declared but not emitted at runtime (v0.2).** The
  manifest states `class: retrieval` / `confidenceType: semantic_similarity`, but
  the response does not attach the per-output signature (`reasoningClass`,
  `evidenceCount`, `independentSources`, `reasoningTrace`). *Fix:* include the
  reasoning block in the result envelope; `evidenceCount` = number of hits;
  `independentSources` is weak for pure retrieval and may stay null. Additive.

## 3. Verdict

**Can IKL Search be a plug-and-play engine? — Yes, with a thin conformance
adapter; no core rewrite.** All eight gaps are additive (manifest, envelope,
typed ids, typed error codes, metric emission, reasoning signature) plus one
optional later extraction (G7). None require changing *what Search does* or *how
it ranks*. Notably, the four v0.2 "quality of thinking" dimensions
(reasoning / changes / capabilities / transformation) were all **declarable for
Search without touching it** — the contract got richer and Search still fit.

Because a real engine fit the enriched contract with additive-only gaps, the
contract design is validated at v0.2. **Implementation remains deferred by
instruction — `runSearch()` is NOT written.** The next step, on explicit approval
only, is the pure-function extraction (G7), then the Composer. Had any gap demanded
changing Search's behaviour, the correct move would have been to revise the
contract first.

**Awaiting explicit approval before any runtime change** (G1/G3/G6/G8 adapter, or
the G7 extraction).
