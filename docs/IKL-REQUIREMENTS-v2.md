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
  specialist reasoning/compute layer (18 engines). Almost entirely not yet built.
- **Part II·5 — Orchestration Tier** *(who decides)* — the decision layer that
  conducts the engines: the Orchestrator, the Learning Priority Engine, and the
  Interface Network. **This is the layer that turns tools into a system.**
- **Part III — Future Vision** *(what the system becomes)* — the closed research
  loop and the long-horizon intelligence platform.

> A knowledge base is a *record of facts*. An engine is a *behaviour over
> facts*. An orchestrator is a *decision over behaviours*. A vision is a
> *direction*. Keeping them apart keeps the roadmap honest.

## Phase transition

This spec marks a deliberate phase change. Until now the work built a
**knowledge base** (Part I) — a record of sourced facts. The next phase builds a
**research system**: specialist engines (Part II) coordinated by a decision layer
(Part II·5) inside a closed learning loop (Part III). The architectural
consequence is a fourth tier that did not exist before:

```
Knowledge Base  →  Knowledge Graph  →  18 Specialized Engines
        →  Reasoning & Orchestration Layer   (NEW — the decision tier)
        →  Learning Priority Engine          (what is most worth learning now)
        →  Interface Network Engine          (nothing in chemistry works alone)
        →  Decision  →  Experiment  →  Knowledge Event  →  ΔK
        →  Industrial Knowledge Library  (loop closes; the system learns)
```

The engines are a *team of specialists*. The Orchestration Tier is the *chief
engineer* who decides which specialists to consult, in what order, and how to
synthesize their answers. Without it, the user must know which engine to call —
which defeats the purpose. **It is not another knowledge library; it is a
decision layer.**

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
8. **Engines are conducted, not called.** No engine is the entry point. A need is
   detected, the Orchestrator plans a sequence of engines, runs them (in order or
   in parallel), and synthesizes. Every synthesized answer still carries the
   provenance and confidence of every engine that contributed, and inherits the
   *lowest* confidence in its chain (uncertainty compounds, never hides).
9. **Every decision is a research question.** A recommendation that rests on a
   knowledge gap must surface that gap to the Learning Priority Engine, closing
   the loop between *deciding* and *learning*.

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
Engines 1–18 are the specialist tactical/strategic engines; **19–20 are
meta-engines** that belong to the Orchestration Tier (Part II·5) and are listed
here only for a single numbered index.

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
| 11 | **Strategic Landscape & White-Space Mapper** (elevated Patent/IP) | Engine | 🟠→🔭 | patents (external feed) + innovation layer + **internal Fresco capabilities** | Beyond single-patent FTO: maps the whole IP terrain, overlays Fresco's real capabilities, and simulates competitive collision paths. Full spec in **II.4**. |
| 12 | **Geopolitical & Supply-Chain Shock** | Engine | 🟠 | supply chain, geo, relationships | Scenario simulation (supplier shutdown, sanctions, shortages, shipping); suggests alternatives + continuity plans. |
| 13 | **Cross-Industry Analogy** | Engine | 🔭 | mechanisms | Find equivalent mechanisms in medicine/food/aerospace/etc.; needs cross-domain corpus. |
| 14 | **Digital Twin Calibration** | Engine | 🔭 | experiments, materials, environment | Per-project calibrated predictive model with uncertainty + continuous learning. |
| 15 | **Relationship Intelligence** | Engine | 🟡→🟠 | `ikl_relationships` (typed) | Model explicit typed relations (improves, reduces, activates, suppresses, requires, compatible_with, contradicts, supports, causes, prevents), each with provenance/confidence/version/status. Storage extension = 🟡; inference = 🟠. |
| 16 | **Combination Discovery** (Virtual Formulation Generator) | Engine | 🔭 | mechanisms, compatibility, performance, cost | Mechanism-driven (not brute-force) combination search; ranks by compatibility/mechanism/risk/confidence/performance/cost/novelty. |
| 17 | **Reliability & Aging** | Engine | 🔭 | performance (aging/weathering), geo | Builds reliability curves; computes probability of failure over service time (UV, humidity, freeze-thaw, mechanical fatigue, corrosion, chemical aging). |
| 18 | **Multi-Objective Optimization** | Engine | 🔭 | all + cost + regulatory | Pareto optimization under conflicting objectives (fire class, cost, workability, VOC, dry time, strength, aesthetics, durability). Answers "cheapest formulation that still meets A1, low VOC, marine climate". |
| 19 | **Learning Priority Engine** | Meta-engine | 🟠 | all gaps + confidence + failures + business context | Ranks *what to learn next*. Belongs to the Orchestration Tier — full spec in **II·5**. |
| 20 | **Interface Network Engine** | Meta-engine / graph | 🟠 | relationships, mechanisms, applications, failures, process/equipment | Models *interfaces* as first-class entities, not just materials. Full spec in **II·5**. |

> **Engines 1–18 answer "how do we do this right?"** Engine 11 (elevated) answers
> "*why* do it, and *where* do we plant the next flag?". Engines 19–20 and the
> Orchestrator answer "*which* experts, in *what* order, and *what* should we
> learn next?" — the strategic and decision planes, not the tactical one.

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

## II.4 Engine 11 — Strategic Landscape & White-Space Mapper

**Status: 🟠→🔭 NEW ARCH → FUTURE.** This is the elevation of "Patent & IP
Intelligence" from a tactical FTO check into a *strategic* capability: instead of
analysing one patent, it scans hundreds of thousands and builds a 3-D map of the
IP terrain. It is the engine that moves MATRIYA from an R&D tool to a strategic
innovation tool — it answers *where to plant the next flag*, not just *how to
build*. Three action layers:

**(a) Patenting Heat-Map.** Marks dense zones ("Red Oceans" — many players, high
legal risk, marginal innovation) versus sparse zones ("White Spaces" — few
patents, room to land). *Example:* "400 patents on 'epoxy coating' in 5 years,
but only 12 on 'epoxy coating with vapour permeability tuned for Mediterranean
climate' — that is your White Space."

**(b) Proprietary Overlay ("Fresco DNA").** The map is never generic — it is
weighted by Fresco's **internal** capabilities: production technology, on-hand
raw materials, and field/experiment history (including *failed* experiments,
which are assets here). *Example:* a White Space that needs freeze-drying you
don't have is filtered out; one that needs pressurised mixing — where a past
failed experiment gave you know-how — scores 9.2/10.
→ **Separation note:** this overlay *reads* internal Fresco knowledge to *rank*
external opportunities. It must honour Principle 5 — it never writes internal
data into the external library; the resulting ranking is a **generated
hypothesis** until validated.

**(c) Collision & Circumvention Paths.** Simulates 5/10/20 years forward:
patent-expiry timelines, competitors' blocking patents and their weak
mechanisms. *Example:* "BASF's series-X patents expire 2029; Evonik is trying to
fence your direction with 3 complementary patents, all weak on mechanism Y which
you control → go for product W (empty space, 18 months dev) and file a
process-patent now, before they do."

*Output is strategic recommendation + provenance + confidence, marked as
hypothesis. The system proposes where to compete; humans decide.*

---

# Part II·5 — Orchestration Tier (the decision layer)

*This is the tier that was missing. The 18 engines are specialists; this tier is
the chief engineer that conducts them. It sits **between the engines and the
user**, and it is where a knowledge base becomes a research system.*

**Status: 🟠 NEW ARCH** (all three components). Prerequisite: enough engines
exist to be worth conducting (≥ Search, Comparison, Compatibility, Substitution,
Cost, Supply-Chain).

## II·5.1 Reasoning & Orchestration Layer (the Orchestrator)

The user never picks an engine. A **need is detected**, the Orchestrator plans a
sequence of engines, runs them (serial where there are dependencies, parallel
where independent), and **synthesizes** a single explainable answer.

*Example — "I want a new mineral plaster":*
```
Need detected → Search → Compatibility → Patent(11) → Cost → Supply-Chain
             → Geo → Simulation(Reliability/Prediction) → Recommendation → Synthesis
```
*Example — "TiO₂ is missing":*
```
Need detected → Supply-Chain → Substitution → Mechanism → Performance
             → Cost → Patent(11) → Recommendation
```
Requirements:
- **Planner:** maps a detected need → an engine plan (DAG), not a fixed pipeline.
- **Executor:** runs the DAG, passing each engine's provenance forward.
- **Synthesizer:** merges outputs into one answer that inherits the *lowest*
  confidence in the chain and lists every contributing source (Principle 8).
- **Gap emitter:** any unanswered sub-question is emitted to II·5.2 (Principle 9).
- Fully auditable: the plan, the engines run, and the synthesis are all logged
  (extends the existing `decision_audit_log` / research-loop machinery).

## II·5.2 Learning Priority Engine (Engine 19)

At any moment there are thousands of knowledge gaps. This engine answers **"what
is most worth learning *now*?"** — the difference between "run another
experiment" and "run *this* experiment."

```
1000 Unknowns → Impact → Uncertainty → Business Value → Experiment Cost → Ranking
```
*Output example:* "Running this experiment cuts uncertainty in the whole
intumescent family by 18%" — a ranked, quantified learning recommendation, not a
vague suggestion. Feeds the Orchestrator (which gaps to chase) and Experimental
Planning (Engine 8) / DoE. This is arguably the highest-leverage meta-engine: it
directs the entire research loop's attention.

## II·5.3 Interface Network Engine (Engine 20)

In chemistry almost nothing works alone. The unit of knowledge is not a material
but an **interface**. This engine models interfaces as first-class entities:

```
Material ↔ Material ↔ Process ↔ Equipment ↔ Environment ↔ Application ↔ User ↔ Standard ↔ Cost
```
So the system stores not just `Material A + Material B` but:
`Interface(A↔B)`, `Interface(B↔Environment)`, `Interface(Process↔Material)`,
`Interface(Material↔Application)`, `Interface(Application↔Failure)`, …

Consequence: **a change in any one component can be traced through its entire
chain of effects.** This is the structural companion of Engine 15 (Relationship
Intelligence): Engine 15 types the edges; Engine 20 elevates interfaces to nodes
so effects propagate across the network. Each interface carries provenance,
confidence, version and status like any other fact.

---

# Part III — Future Vision (intelligence platform)

*Direction: what the system becomes once the knowledge base is populated and the
engines mature.*

## III.1 Continuous Learning Loop

**Status: 🔭 FUTURE VISION** (partial substrate exists: `experiments`,
`doe_designs`, research loop in `matriya-back`).

The closed loop, with the Orchestration Tier in place, is the final
architecture — every decision leads to an experiment, every experiment produces
a Knowledge Event, every event updates the library, and the system learns for
the next project:

```
Industrial Knowledge Library → Knowledge Graph → 18 Specialized Engines
   → Reasoning & Orchestration Layer → Learning Priority Engine → Interface Network Engine
   → Decision → Experiment → Knowledge Event → ΔK
   → (human-gated validation) → Industrial Knowledge Library   ⟲
```

The system becomes smarter after every project — **only through human-gated
validation**, never auto-promotion. What was a static repository becomes a system
that *manages the evolution of knowledge over time*.

## III.2 Long-term platform

A continuously evolving industrial intelligence platform integrating chemistry,
engineering, economics, regulation, field performance, supply-chain resilience,
experimental science and organizational knowledge into a **single explainable
system**. Purpose: shorten R&D cycles, reduce engineering uncertainty, preserve
organizational knowledge, and generate new validated insights over time.

Realizing it depends on: a populated knowledge base (Part I at scale), the
reasoning engines (Part II), the Orchestration Tier that conducts them
(Part II·5), and the predictive/discovery engines (7, 13, 14, 16, 17) maturing on
top of real data. The Orchestration Tier is what makes the platform a *decision*
system rather than a search box.

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
  (semantic search + bulk import + reindex). Engines 2–20 not built.
- **Orchestration tier (II·5):** 🟠 not built — the decision layer that conducts
  the engines. This is the phase the project is now entering.
- **Future vision:** 🔭 substrate only (closed research loop).

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
   (Engines 2, 4, 5 read-side). Makes it a knowledge *graph*, not silos. Extend
   here toward **interfaces as first-class nodes** (Engine 20 storage).
3. **Ingestion pipeline** *(🟠, II.3)* — one connector + TDS/SDS parsing +
   versioned re-fetch + entity resolution + source-trust. Biggest scaling lever.
4. **Reasoning engines on real data** *(🟠)* — Recommendation (3), Substitution
   (5), Material Selection (6), Sustainability (10), Semantic Translator (II.2).
5. **Stand up the Orchestration Tier** *(🟠, II·5)* — once ~6 engines exist,
   build the Orchestrator (planner → executor → synthesizer over the existing
   `decision_audit_log`/research-loop), then the **Learning Priority Engine (19)**
   and the **Interface Network Engine (20)**. *This is the step that turns the
   toolset into a research system — do it as soon as enough engines justify it,
   not last.*
6. **IKL-backed QA** integrated with the existing kernel/RAG while preserving
   separation — the Orchestrator becomes the answer path.
7. **Discovery & strategy** *(🟠/🔭)* — Strategic Landscape & White-Space Mapper
   (11, II.4), Supply-Chain Shock (12), Combination Discovery (16), plus the
   validation workflow.
8. **Predictive & platform** *(🔭)* — Performance Prediction (7), Reliability &
   Aging (17), Multi-Objective Optimization (18), Digital Twin (14),
   Cross-Industry Analogy (13), and the closed Continuous Learning Loop (III.1).

## V.3 Requirement → status quick index

| Bucket | Implemented | Partial | Fits arch | New arch | Future |
|--------|-------------|---------|-----------|----------|--------|
| Knowledge base (Layers 1–14 + cross-cutting) | Layers 1–3,5–12; provenance; versioning; separation; confidence storage | Layers 4, 13, 14 | hierarchy depth, mechanism sub-typing, review-status field | Digital assets (patterns, decision trees, knowledge events, evolution chains) | — |
| Engines (1–20 + translator + confidence + ingestion) | — | Engine 1 | Engine 2; Confidence Engine; Engines 4/5/15 (storage/read side) | Engines 3,6,8,10,11,12,19,20; Semantic Translator; ingestion pipeline | Engines 7,9,13,14,16,17,18; Engine 11 strategic layers |
| Orchestration tier (II·5) | — | — | — | Orchestrator; Learning Priority (19); Interface Network (20) | closed-loop autonomy |
| Vision | — | learning-loop substrate | — | — | Continuous Learning Loop; platform |

---

*This document is methodology-first. Implementation details and API contracts
for the built portions live in `INDUSTRIAL-KNOWLEDGE-LIBRARY.md`. When an engine
moves from spec to build, add its contract there and flip its status here.*
