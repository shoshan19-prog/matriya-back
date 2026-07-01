# MATRIYA — Industrial Knowledge Library (IKL) v2.0 — Requirements

**Status:** consolidated requirements specification
**Scope:** construction materials, coatings, fire protection, restoration, concrete
technology, minerals, polymers and specialty chemicals.
**Companion documents:** `INDUSTRIAL-KNOWLEDGE-LIBRARY.md` (implementation & API
reference for what is already built).

This document consolidates everything discussed for the IKL into a single
requirements spec. Its organizing principle is a deliberate separation of
**methodology from implementation**, so the two are never confused:

- **Part I — Knowledge Base** *(what the system knows)* — the data layers,
  their schema, provenance and lifecycle. This is largely built.
- **Part II — Engines** *(what the system does with what it knows)* — the
  reasoning/compute layer. Almost entirely not yet built.
- **Part III — Future Vision** *(what the system becomes)* — the long-horizon
  intelligence platform.

> A knowledge base is a *record of facts*. An engine is a *behaviour over
> facts*. A vision is a *direction*. Keeping them apart keeps the roadmap honest.

---

## Status legend

| Tag | Meaning |
|-----|---------|
| ✅ **IMPLEMENTED** | Shipped in the current branch (`claude/matriya-industrial-knowledge-lib-9sik82`, `matriya-back`). |
| 🟢 **PARTIAL** | Foundations shipped; capability incomplete. |
| 🟡 **FITS ARCH** | Not built, but needs **no new architecture** — additive to what exists. |
| 🟠 **NEW ARCH** | Requires a **new engine/subsystem** (service, model, pipeline, or data feed). |
| 🔭 **FUTURE VISION** | Long-horizon / research-grade; depends on multiple engines maturing. |

---

## Architectural principles (normative)

These apply to every layer and every engine. They are requirements, not
aspirations.

1. **Independent layers.** Each layer has its own schema, provenance,
   confidence, version history and validation status.
2. **Append-only knowledge.** Knowledge is never overwritten — only appended.
   Every change preserves prior versions.
3. **Provenance-based.** No orphan knowledge: every fact traces to a source.
4. **Nothing validates automatically.** Hypotheses and external facts stay
   unvalidated until a human promotes them.
5. **Three separate domains.** External knowledge, internal Fresco knowledge,
   and generated hypotheses are kept strictly separate. External never
   overwrites internal; connections between them are hypotheses until validated.
6. **Always explainable & auditable.** Every answer must be traceable,
   versioned, scientifically defensible, and must expose (never hide)
   uncertainty.
7. **Never invent chemistry.** The system stores and reasons over sourced facts;
   it does not fabricate chemical/engineering claims.

---

# Part I — Knowledge Base (data layers)

*Methodology: how knowledge is stored, sourced, versioned and trusted.*
This part is the current center of gravity of the implementation.

## I.1 Core library layers

Numbering follows the v2.0 spec. "Table" refers to the shipped schema.

| # | Layer | Status | Table(s) | Notes / gap |
|--:|-------|--------|----------|-------------|
| 1 | Companies / Brands / Manufacturers / hierarchy | ✅ | `ikl_companies`, `ikl_brands` | Business hierarchy is flat arrays today; deep hierarchy = 🟡. |
| 2 | Commercial Products | ✅ | `ikl_products` | Identity + classification + properties. |
| 3 | Raw Materials (CAS, families, aliases, suppliers) | ✅ | `ikl_raw_materials` | |
| 4 | Mechanisms (chemical, physical, mineralogical, fire, transport, hydration, surface) | 🟢 | `ikl_mechanisms` | Schema + names seeded; scientific content requires sourcing. Mechanism *sub-typing* (fire/transport/…) = 🟡. |
| 5 | Applications (concrete, mortar, plaster, stone, wood, metal, gypsum, roofing, restoration, fire, infrastructure) | ✅ | `ikl_applications` | |
| 6 | Supply Chain (lead time, availability, shelf life, storage, packaging, import, risk) | ✅ | `ikl_supply_chain` | Static storage only; *risk simulation* is Engine 12. |
| 7 | Regulation (REACH, RoHS, CLP, VOC, CE, fire, environmental, hazards) | ✅ | `ikl_regulatory` | Storage only; standards are free-form JSON, not a validated register. |
| 8 | Compatibility (compatible, incompatible, alternative, substitute, requires, avoid_with) | ✅ | `ikl_relationships` | Storage of relationships; *reasoning* over them is Engines 4/5/15. |
| 9 | Experimental Performance (measured / claimed / observed / field / lab / aging / weathering) | ✅ | `ikl_performance` | `source_kind` separates measured vs. claimed. |
| 10 | Value Engineering (install cost, lifecycle, maintenance, replacement, ROI, LCCA) | ✅ | `ikl_value_engineering` | Storage only; no computation — never estimate without a source. |
| 11 | Geo Context (climate, humidity, UV, marine, freeze-thaw, regional standards, methods) | ✅ | `ikl_geo_context` | |
| 12 | Failure Library (failures, root causes, lessons, corrective, preventive) | ✅ | `ikl_failures` | The "negative knowledge base". |
| 13 | Innovation Layer (research opportunities, tech gaps, supplier/patent opportunities, open questions) | 🟢 | `ikl_opportunities` | Storage + hypothesis lifecycle; *discovery* is Engines 11/16. |
| 14 | Digital Knowledge Assets (mechanism graphs, engineering patterns, decision trees, knowledge events, evolution chains) | 🟢 | `ikl_mechanisms` + `ikl_mechanism_edges` | Mechanism graph built. Patterns / decision trees / knowledge events / evolution chains = 🟠. |

## I.2 Cross-cutting knowledge concerns

| Concern | Status | Where | Notes |
|---------|--------|-------|-------|
| **Provenance** (source, evidence, confidence, review status, version, timestamp, author) | ✅ | `ikl_sources` + per-record `source_id`, `confidence`, `version` | `author`/`review status` captured via `ikl_record_history.changed_by` and connection validation; a first-class review-status field per record = 🟡. |
| **Version history** (append-only) | ✅ | `ikl_record_history` | Snapshot-on-update, monotonically increasing `version`. |
| **Domain separation** (external / internal / hypotheses) | ✅ | `knowledge_domain` guard + `ikl_connections` (opaque `fresco_ref`, hypothesis-until-validated) | |
| **Confidence storage** | ✅ | `confidence` column on every record + on sources | Value is *stored*; *deriving* it is the Confidence Engine (Part II). |

## I.3 Knowledge sources (ingestion targets)

Storage exists; **automated ingestion does not** (🟠 — Part II, ingestion
pipeline). The system should gradually absorb:

- **External / public:** chemical companies (BASF, Evonik, Dow, Arkema, Wacker,
  Sika, Master Builders Solutions, Saint-Gobain, Mapei, Fosroc, RPM, Sherwin
  Williams, Akzo Nobel, PPG, Clariant, Lanxess, Ashland, Lubrizol, Brenntag,
  Cabot, Elkem, Grace, Omya, Imerys, Elementis, BYK, Münzing, Kao, Momentive,
  Huntsman, Kemira, …); TDS, SDS, scientific papers, patents, technical notes,
  standards (ASTM, EN, ISO, DIN, ACI, RILEM), conference papers, supplier docs.
- **Internal (Fresco):** R&D, lab reports, burn tests, pull-off, weathering,
  field observations, failures, customer feedback, production/formulation
  history, equipment logs, Knowledge Events. *These live in the internal domain
  and are never overwritten by external ingestion.*

> Target-company and taxonomy **names** are seeded as controlled vocabulary
> (no chemistry). See `scripts/seed-ikl-vocabulary.js`.

---

# Part II — Engines (computation & reasoning)

*Implementation: behaviours the system performs over the knowledge base.*
Each engine reads the knowledge base and produces derived, provenance-tagged,
non-auto-validated output. **Engine 1 is partially built; the rest are not.**

| # | Engine | Bucket | Status | Primary inputs | Notes / what "new arch" means here |
|--:|--------|--------|--------|----------------|-------------------------------------|
| 1 | **Industrial Search** | Engine | 🟢 | all layers + `ikl_embeddings` | Semantic + keyword search shipped (`POST /ikl/search`). Faceted/entity-aware ranking = 🟡. |
| 2 | **Comparison** | Engine | 🟡 | products, performance, regulatory, value | Side-by-side over existing data; read-side aggregation, no new store. |
| 3 | **Recommendation** | Engine | 🟠 | all + relationships + failures | Ranking model + rationale generation with provenance. |
| 4 | **Compatibility** | Engine | 🟡→🟠 | `ikl_relationships`, mechanisms | Graph traversal over stored relationships (🟡); mechanism-derived inference (🟠). |
| 5 | **Substitution** | Engine | 🟡→🟠 | relationships, products, supply chain | Path-finding over substitute/alternative edges (🟡); constrained substitution (🟠). |
| 6 | **Material Selection** | Engine | 🟠 | all layers | Requirement → candidate set under constraints; overlaps Engine 18. |
| 7 | **Performance Prediction** | Engine | 🔭 | performance, geo, aging | Predictive model; needs data volume + validation. Overlaps Engines 14/17. |
| 8 | **Experimental Planning** | Engine | 🟠 | mechanisms, failures, performance | Ties to existing DoE (`doe_designs`) + research loop in `matriya-back`. |
| 9 | **Process Stability** | Engine | 🔭 | production/equipment logs (internal) | Depends on internal production data feeds. |
| 10 | **Sustainability** (carbon, VOC, recycling, impact) | Engine | 🟠 | products, regulatory, raw materials | Needs a carbon/VOC reference dataset + computation. |
| 11 | **Patent & IP Intelligence** (FTO, landscape, white-space) | Engine | 🟠 | patents (external feed) + innovation layer | Requires a patent data feed + landscape analytics. |
| 12 | **Geopolitical & Supply-Chain Shock** | Engine | 🟠 | supply chain, geo, relationships | Scenario simulation (supplier shutdown, sanctions, shortages, shipping); suggests alternatives + continuity plans. |
| 13 | **Cross-Industry Analogy** | Engine | 🔭 | mechanisms | Find equivalent mechanisms in medicine/food/aerospace/etc.; needs cross-domain corpus. |
| 14 | **Digital Twin Calibration** | Engine | 🔭 | experiments, materials, environment | Per-project calibrated predictive model with uncertainty + continuous learning. |
| 15 | **Relationship Intelligence** | Engine | 🟡→🟠 | `ikl_relationships` (typed) | Model explicit typed relations (improves, reduces, activates, suppresses, requires, compatible_with, contradicts, supports, causes, prevents), each with provenance/confidence/version/status. Storage extension = 🟡; inference = 🟠. |
| 16 | **Combination Discovery** (Virtual Formulation Generator) | Engine | 🔭 | mechanisms, compatibility, performance, cost | Mechanism-driven (not brute-force) combination search; ranks by compatibility/mechanism/risk/confidence/performance/cost/novelty. |
| 17 | **Reliability & Aging** | Engine | 🔭 | performance (aging/weathering), geo | Builds reliability curves; computes probability of failure over service time (UV, humidity, freeze-thaw, mechanical fatigue, corrosion, chemical aging). |
| 18 | **Multi-Objective Optimization** | Engine | 🔭 | all + cost + regulatory | Pareto optimization under conflicting objectives (fire class, cost, workability, VOC, dry time, strength, aesthetics, durability). Answers "cheapest formulation that still meets A1, low VOC, marine climate". |

## II.1 Confidence Engine

**Status: 🟡 FITS ARCH.** Confidence is *stored* today; the engine that
*derives* it is not built, but it needs no new architecture — a scoring function
keyed on source `document_type`/domain. Reference rubric:

| Evidence | Confidence |
|----------|-----------:|
| Internal validated experiment | 0.95 |
| Peer-reviewed, replicated paper | 0.85 |
| Scientific paper | 0.75 |
| Manufacturer TDS | 0.60 |
| Expert opinion | 0.40 |
| Hypothesis | 0.20 |

Rule: **never hide uncertainty — always expose it** in every engine's output.

## II.2 Semantic Engineering Translator

**Status: 🟠 NEW ARCH.** Translates lay/engineering language into measurable
phenomena so users need no laboratory terminology. Example:

> "My plaster peels" → { low pull-off, high moisture, carbonation, poor
> adhesion, salt contamination, wrong curing }

Requires a curated phenomenon-mapping layer (symptom → measurable candidates),
linked to the Failure Library (Layer 12) and Mechanisms (Layer 4). Output is a
ranked set of hypotheses — never a diagnosis.

## II.3 Ingestion pipeline (implied by "Knowledge Sources")

**Status: 🟠 NEW ARCH.** Connectors for official sites, TDS/SDS PDF parsing,
scheduling, change-detection and versioned re-fetch, plus entity resolution
(dedup companies/brands, CAS→material, synonym merge) and a source-trust model
("prefer official sources"). This is the largest lever for scaling the knowledge
base and the prerequisite for most engines being useful.

---

# Part III — Future Vision (intelligence platform)

*Direction: what the system becomes once the knowledge base is populated and the
engines mature.*

## III.1 Continuous Learning Loop

**Status: 🔭 FUTURE VISION** (partial substrate exists: `experiments`,
`doe_designs`, research loop in `matriya-back`).

```
Every project → new experiments / failures / observations / decisions
             → Knowledge Events
             → ΔK (knowledge delta)
             → Validated Knowledge (human-gated)
             → Updated Industrial Library
             → Better recommendations → better future projects
```

The system becomes smarter after every project — **only through human-gated
validation**, never auto-promotion.

## III.2 Long-term platform

A continuously evolving industrial intelligence platform integrating chemistry,
engineering, economics, regulation, field performance, supply-chain resilience,
experimental science and organizational knowledge into a **single explainable
system**. Purpose: shorten R&D cycles, reduce engineering uncertainty, preserve
organizational knowledge, and generate new validated insights over time.

Realizing it depends on: a populated knowledge base (Part I at scale), the
reasoning engines (Part II), and the predictive/discovery engines (7, 13, 14,
16, 17) maturing on top of real data.

---

# Part IV — Constraints (hard rules, non-negotiable)

1. Never invent chemistry.
2. Never promote hypotheses automatically.
3. Keep external knowledge, internal Fresco knowledge, and generated hypotheses
   separate; external never overwrites internal.
4. Everything auditable, traceable, versioned, explainable, scientifically
   defensible.
5. Always expose uncertainty; never hide it.

These are already enforced structurally in the knowledge base (domain guard,
provenance requirement, append-only history, hypothesis lifecycle) and **must be
honored by every future engine's output** (each engine returns provenance +
confidence and marks generated content as hypothesis).

---

# Part V — Implementation status & incremental build order

## V.1 Where we are

- **Knowledge base:** ✅ substantially complete (Layers 1–13, Layer 14 partial;
  provenance, versioning, separation, confidence storage).
- **Engines:** 🟢 only Engine 1 (Industrial Search) partially shipped
  (semantic search + bulk import + reindex). Engines 2–18 not built.
- **Future vision:** 🔭 substrate only.

Delivered artifacts (in `matriya-back`): `iklModels.js`, `iklEndpoints.js`,
`iklVectorStore.js`, `sql/industrial_knowledge_library.sql`,
`scripts/seed-ikl-vocabulary.js`, mounted at `/ikl`.

## V.2 Recommended build order

Each step de-risks the next: **data → connections → automated data → trust →
reasoning → discovery.**

1. **Finish the knowledge base ergonomics** *(🟡)* — Confidence Engine (II.1,
   cheap win), first-class per-record review-status, typed relationships
   (Engine 15 storage), front-end browse/search/validate UI.
2. **Connect the layers** *(🟡)* — cross-layer links + graph traversal
   (Engines 2, 4, 5 read-side). Makes it a knowledge *graph*, not silos.
3. **Ingestion pipeline** *(🟠, II.3)* — one connector + TDS/SDS parsing +
   versioned re-fetch + entity resolution + source-trust. Biggest scaling lever.
4. **Reasoning engines on real data** *(🟠)* — Recommendation (3), Substitution
   (5), Material Selection (6), Sustainability (10), Semantic Translator (II.2).
5. **IKL-backed QA** integrated with the existing kernel/RAG while preserving
   separation — turns the library into an answering system.
6. **Discovery & simulation** *(🟠/🔭)* — Patent/IP (11), Supply-Chain Shock
   (12), Combination Discovery (16), plus validation workflow.
7. **Predictive & platform** *(🔭)* — Performance Prediction (7), Reliability &
   Aging (17), Multi-Objective Optimization (18), Digital Twin (14),
   Cross-Industry Analogy (13), and the Continuous Learning Loop (III.1).

## V.3 Requirement → status quick index

| Bucket | Implemented | Partial | Fits arch | New arch | Future |
|--------|-------------|---------|-----------|----------|--------|
| Knowledge base (Layers 1–14 + cross-cutting) | Layers 1–3,5–12; provenance; versioning; separation; confidence storage | Layers 4, 13, 14 | hierarchy depth, mechanism sub-typing, review-status field | Digital assets (patterns, decision trees, knowledge events, evolution chains) | — |
| Engines (1–18 + translator + confidence + ingestion) | — | Engine 1 | Engine 2; Confidence Engine; Engines 4/5/15 (storage/read side) | Engines 3,6,8,10,11,12; Semantic Translator; ingestion pipeline | Engines 7,9,13,14,16,17,18 |
| Vision | — | learning-loop substrate | — | — | Continuous Learning Loop; platform |

---

*This document is methodology-first. Implementation details and API contracts
for the built portions live in `INDUSTRIAL-KNOWLEDGE-LIBRARY.md`. When an engine
moves from spec to build, add its contract there and flip its status here.*
