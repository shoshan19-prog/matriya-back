# MATRIYA — Industrial Knowledge Library (IKL)

The IKL is MATRIYA's **external scientific reference layer**: a structured
engineering knowledge base built from public industrial sources. It is a
separate knowledge domain from Fresco's internal knowledge and is designed to
answer not only *"what product should I use?"* but *why it works*, *where it
fails*, *what alternatives exist*, and *what the next opportunity is*.

This document describes the backend foundation delivered in `matriya-back`.

## Core principles (enforced in code)

| Principle | Where enforced |
|-----------|----------------|
| **Provenance required** — no orphan knowledge | `iklEndpoints.js` rejects writes to fact-stating layers without a `source_id`/inline `source`; `source_id` → `ikl_sources` |
| **Separation from Fresco** — external never overwrites internal | `ikl_` table namespace; `knowledge_domain` CHECK-constrained to `'external'`; the only bridge (`ikl_connections`) references internal by an **opaque string**, never a foreign key |
| **Connections are hypotheses until validated** | `ikl_connections.status` defaults to `hypothesis`; a human validates via `POST /ikl/connections/:id/validate` |
| **No invented chemistry** | The seed loads *names only*; scientific principles / properties / performance are left empty until a real source is attached |
| **Version history preserved** | Every update snapshots the prior state into `ikl_record_history` and bumps `version` — no silent overwrite |
| **Innovation output is a hypothesis** | `ikl_opportunities.status` defaults to `hypothesis` |

## Files

- `iklModels.js` — Sequelize models for all layers + the `IKL_LAYERS` registry.
- `iklEndpoints.js` — the `/ikl` router (generic CRUD + graph + connections).
- `sql/industrial_knowledge_library.sql` — production DDL (run in Supabase SQL Editor).
- `scripts/seed-ikl-vocabulary.js` — seeds controlled vocabulary only.
- Wired into `server.js` via `app.use('/ikl', iklRouter)`.

Tables are also created automatically by `initDb()`'s `sequelize.sync({ alter: false })`,
which only creates missing tables and never alters existing Fresco tables.

## The 14 layers → tables

| Layer | Purpose | Table | API layer key |
|------:|---------|-------|---------------|
| 1 | Companies / Brands | `ikl_companies`, `ikl_brands` | `companies`, `brands` |
| 2 | Commercial Products | `ikl_products` | `products` |
| 3 | Raw Materials | `ikl_raw_materials` | `raw-materials` |
| 4 | Functional Mechanisms | `ikl_mechanisms` | `mechanisms` |
| 5 | Applications | `ikl_applications` | `applications` |
| 6 | Supply Chain | `ikl_supply_chain` | `supply-chain` |
| 7 | Regulatory & Safety | `ikl_regulatory` | `regulatory` |
| 8 | Compatibility & Substitution | `ikl_relationships` | `relationships` |
| 9 | Experimental Performance | `ikl_performance` | `performance` |
| 10 | Mechanism Knowledge Graph | `ikl_mechanism_edges` (+ `ikl_mechanisms` nodes) | `mechanism-edges` |
| 11 | Value Engineering | `ikl_value_engineering` | `value-engineering` |
| 12 | Geo Context | `ikl_geo_context` | `geo-context` |
| 13 | Failure Knowledge Library | `ikl_failures` | `failures` |
| 14 | Innovation & Opportunity | `ikl_opportunities` | `opportunities` |
| — | Provenance | `ikl_sources` | (`/ikl/sources`) |
| — | Version history | `ikl_record_history` | (`/ikl/:layer/:id/history`) |
| — | External ↔ Fresco bridge | `ikl_connections` | (`/ikl/connections`) |

Layer 9 keeps **measured** performance separate from **manufacturer claims**
via the `source_kind` field (`measured` | `manufacturer_claim`).

## API

Base path: `/ikl`. Reads require any authenticated user; writes require an admin.

### Discovery
- `GET /ikl` — library catalogue + endpoint map.
- `GET /ikl/overview` — per-layer counts, source count, connection/hypothesis counts.

### Generic per-layer CRUD
- `GET  /ikl/:layer?limit&offset&q=&<field>=` — list/filter (`q` = name-ish substring).
- `GET  /ikl/:layer/:id` — one record (includes its source).
- `GET  /ikl/:layer/:id/history` — version history.
- `POST /ikl/:layer` *(admin)* — create. Fact-stating layers require provenance.
- `PUT  /ikl/:layer/:id` *(admin)* — update (snapshots previous version).

### Provenance
- `GET  /ikl/sources` / `POST /ikl/sources` *(admin)*.

### Graphs
- `GET /ikl/graph/mechanisms` — mechanism nodes + cause-effect edges.
- `GET /ikl/graph/relationships?type=` — compatibility/substitution graph.

### Separation bridge
- `GET  /ikl/connections?status=` — external↔Fresco links.
- `POST /ikl/connections` *(admin)* — always created as `hypothesis`.
- `POST /ikl/connections/:id/validate` *(admin)* — body `{ "decision": "validate" | "reject" }`.

### Providing provenance on a write

Attach an existing source:

```json
POST /ikl/products
{ "product_name": "Acronal S 559", "company_id": 1, "classification": "Acrylic Binder",
  "source_id": 12 }
```

…or create the source inline (recommended, keeps knowledge non-orphan):

```json
POST /ikl/raw-materials
{ "chemical_family": "Silane", "cas": "...", "functional_role": "Hydrophobic Agent",
  "source": { "document_type": "tds", "url": "https://…", "publisher": "Wacker",
              "retrieval_date": "2026-07-01", "confidence": 0.9 } }
```

A write to a fact-stating layer with no source returns `400 Provenance required`.

## Seeding controlled vocabulary

```bash
node scripts/seed-ikl-vocabulary.js
```

Seeds target-company names, functional-mechanism names, and application domains
from the specification — **names only**, bound to a `matriya_seed` source with
low confidence. No chemistry, properties, or performance data is invented.

## Separation rule (summary)

```
External Industrial Knowledge  (ikl_* tables, knowledge_domain='external')
        ↓  ikl_connections (opaque fresco_ref, status='hypothesis')
Fresco Internal Knowledge      (rag_documents, experiments, … — untouched by IKL)
        ↓
Validated Connections          (status='validated', set only by a human)
```

External information never overwrites internal knowledge. A connection stays a
hypothesis until explicitly validated.
