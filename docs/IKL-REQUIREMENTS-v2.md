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
  specialist reasoning/compute layer (Engines 1–18, decision/discovery engines
  21 & 25, and the visualization/explanation engine 27). Almost entirely not yet
  built.
- **Part II+ — Orchestration Tier** *(who decides)* — the decision layer that
  conducts the engines: the Engine Contract (II+.0) + Composer, Learning Priority (19), Interface
  Network (20), Knowledge Gap (22), Autonomous Experiment Planner (23),
  Industrial Memory (24), and — at the apex — Meta-Learning (26), which learns
  the research process itself. **This is the layer that turns tools into a
  system.**
- **Part III — Future Vision** *(what the system becomes)* — the closed research
  loop and the long-horizon intelligence platform.

> A knowledge base is a *record of facts*. An engine is a *behaviour over
> facts*. An orchestrator is a *decision over behaviours*. A vision is a
> *direction*. Keeping them apart keeps the roadmap honest.

## Phase transition

This spec marks a deliberate phase change. Until now the work built a
**knowledge base** (Part I) — a record of sourced facts. The next phase builds a
**research system**: specialist engines (Part II) coordinated by a decision layer
(Part II+) inside a closed learning loop (Part III). The architectural
consequence is a fourth tier that did not exist before:

```
Knowledge Base  →  Knowledge Graph  →  18 Specialized Engines
        →  Engine Contract + Composer        (NEW — the decision tier, contract-first)
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
   detected, the Composer plans a sequence of engines, runs them (in order or in
   parallel), and synthesizes. Every synthesized answer still carries the
   provenance and confidence of every engine that contributed, and inherits the
   *lowest* confidence in its chain (uncertainty compounds, never hides).
9. **Every decision is a research question.** A recommendation that rests on a
   knowledge gap must surface that gap to the Learning Priority Engine, closing
   the loop between *deciding* and *learning*.
10. **Engines are stateless and contract-bound (Plug & Play).** Every engine
    satisfies the same **Engine Contract** and is *stateless*: `Input → Output`,
    knowing nothing about who called it or what runs next. The management layer
    never hard-codes a list of engines — it runs anything that satisfies the
    contract. The contract declares not only I/O but the **quality of thinking**:
    a *reasoning signature* (what the confidence means), *state changes* (pure vs.
    stateful), a *capability vector* (observe/explain/predict/recommend/generate/
    validate/learn), and a *transformation*. **Define the contract before the
    conductor.** (See `docs/engine-contract/`.)
11. **An engine is defined by what it transforms, not by what it is.**
    `Input → Transformation → Output`, never `Module → Output`. This reframes the
    platform from "a collection of services" into "a collection of
    transformations" — the property that makes composition meaningful.

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
Engines 1–18 are the specialist tactical/strategic engines; 21 (Trade-off) and 25
(Strategic Opportunity) are cross-cutting decision/discovery engines; 27
(Scientific Visualization) is the presentation/explanation layer; **19, 20, 22,
23, 24, 26 are meta-engines** that belong to the Orchestration Tier (Part II+)
and are listed in this table only for a single numbered index.

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
| 19 | **Learning Priority Engine** | Meta-engine | 🟠 | all gaps + confidence + failures + business context | Ranks *what to learn next*. Belongs to the Orchestration Tier — full spec in **II+**. |
| 20 | **Interface Network Engine** | Meta-engine / graph | 🟠 | relationships, mechanisms, applications, failures, process/equipment | Models *interfaces* as first-class entities, not just materials. Full spec in **II+**. |
| 21 | **Engineering Trade-off Engine** | Decision-support | 🟠 | performance, cost, regulatory, value | The *explainability* face of optimization: expresses every gain as its costs ("+18% fire → −6% workability, +9% cost"). Complements Engine 18 (finds the Pareto front) and Engine 2 (compares). Spec **II.5**. |
| 22 | **Knowledge Gap Engine** | Research-direction | 🟠 | all layers + confidence | Maps *what we don't know* — coverage heat-map per mechanism/material. **Feeds** Engine 19: Gap detects the holes, Priority ranks which to close. Spec **II+.4**. |
| 23 | **Autonomous Experiment Planner** | Research-direction | 🟠 | mechanisms, failures, performance, cost | Elevates Engine 8 with a **Knowledge-ROI** objective (ΔK ÷ cost ÷ time). The concrete objective function the loop optimizes. Spec **II+.5**. |
| 24 | **Industrial Memory Engine** | Loop infrastructure | 🟠 | decisions, experiments, outcomes (internal) | Organizational memory: decision → reason → experiment → outcome → lesson. **Realizes** Layer 14 Knowledge Events + evolution chains as an active capture engine. Spec **II+.6**. |
| 25 | **Strategic Opportunity Engine** | Strategy / discovery | 🟠→🔭 | market, competitors, patents, regulation, trends + **internal capabilities** | Hunts *opportunities* (not problems): Opportunity Score + "you already hold the mechanism to enter this market." Extends Engines 11 & 13; shares the Fresco-DNA overlay (Principle 5). Spec **II.6**. |
| 26 | **Meta-Learning Engine** | Apex meta-engine | 🔭 | the entire decision/experiment history | Learns **how the organization discovers knowledge** — which experiment types led to breakthroughs, which mistakes recur, which strategies/teams excel. Improves the *innovation process itself*. Spec **II+.7**. |
| 27 | **Scientific Visualization Engine** | Presentation / explanation | 🟠→🔭 | mechanisms, interfaces, formula/experiment history, fire/aging, the loop | Renders knowledge as **mechanism**, not data: molecular views, mechanism animations, interface/process/fire simulations, and a Google-Maps-style multi-scale zoom (Building→Bond). Cross-cutting over most layers/engines. Spec **II.7**. |
| 28 | **Visual Reasoning Engine** | Presentation / reasoning | 🔭 | any engine's inference trace | Shows the *thinking*, not the data: renders the causal reasoning chain (Stone→Moisture→Salt→Binder→Crack→Failure). Sibling of 27 (which shows mechanisms/molecules); 28 shows the *inference path*. Spec **II+.8**. |
| 29 | **Knowledge Replay Engine** | Learning / audit | 🔭 | Industrial Memory (24) + provenance chains | "Runs the tape" forwards/backwards: Failure→Decision→Experiment→Formulation→Knowledge Event→Evidence→Observation, or Observation→…→Market Success. A learning/onboarding tool built on append-only history. Spec **II+.9**. |
| 30 | **Interface Physics Engine** | Foundational substrate | 🔭 | every component in the system | **Engine 20 elevated from a data model to the platform's substrate.** Not a library — a physics: every component (Material, Process, Equipment, Climate, Worker, Surface, Regulation, Cost, Supply Chain) exists through its *interfaces*, and **every engine reads/writes the same interface graph**. Spec **II+.3b**. |

> **Engines 1–18 answer "how do we do this right?"** Engine 11 (elevated) answers
> "*why* do it, and *where* do we plant the next flag?". Engines 19–26 and the
> Composer answer "*which* experts, in *what* order, *what* should we learn next,
> and how do we get better at learning itself?". Engines 27–28 answer "*make me
> see and understand it*", 29 "*show me how we got here*", and 30 is the
> **substrate** the rest stand on — the strategic, decision, meta, comprehension,
> and foundational planes, not just the tactical one.

### Numbering & de-duplication note

The v2.1 additions proposed as "19–23 + Meta-Learning" are indexed here as
**21–26**, and the v2.2 Scientific Visualization Engine (proposed as "24") as
**27**, to avoid colliding with earlier assignments (19 Learning Priority,
20 Interface Network, 24 Industrial Memory). Several of the new engines are
**refinements of existing ones, not new silos** — kept distinct only where they
add a genuinely new behaviour. The intended relationships:

| New engine | Relationship to existing |
|-----------|---------------------------|
| 21 Trade-off | The *explainability* output of 18 (Multi-Objective Optimization) + 2 (Comparison). |
| 22 Knowledge Gap | The *detector* that feeds 19 (Learning Priority) the ranked *closer*. |
| 23 Autonomous Experiment Planner | 8 (Experimental Planning) with an explicit Knowledge-ROI objective; driven by 19+22. |
| 24 Industrial Memory | The active-capture realization of Layer 14 (Knowledge Events / evolution chains). |
| 25 Strategic Opportunity | Business-facing sibling of 11 (patent white-space) + 13 (innovation layer). |
| 26 Meta-Learning | Apex: consumes 24's memory to improve the whole loop. Depends on all others. |
| 27 Scientific Visualization | Presentation layer over Layer 4 (mechanisms), Engine 20 (interfaces), formula/experiment history and Engines 16/17 — it *renders* existing knowledge, it does not create any. |
| 28 Visual Reasoning | Presentation of the *inference path* (why), complementary to 27's *mechanism* view (what/how). |
| 29 Knowledge Replay | A traversal of Industrial Memory (24) + append-only provenance; creates nothing, replays what exists. |
| 30 Interface Physics | Not a peer engine — the **elevation of Engine 20** into the shared substrate all engines operate on. |

Do **not** build these as independent services — build 22→19, 23←8, 24←Layer 14
as extensions, reserve 26 for last, treat 27/28 as rendering layers and 29 as a
memory traversal, and treat 30 as the substrate that Engine 20 grows into (not a
new silo).

### Frozen backlog — Discovery Perturbation family (not in the active count)

The engine list is **frozen at ~30** (strategic decision: harden the three
assets, don't keep adding engines). These captured ideas extend Engine 16
(Combination Discovery) into *controlled perturbation* — the thesis that real
novelty comes from disciplined disturbance, not optimization, with each "noise"
calibrated by ΔK, knowledge distance and validation cost. They are recorded here,
**not activated**, and — being generative — would inherit the Engine Contract's
hypothesis safety envelope (outputs are hypotheses, never facts):

- **Epistemic Frame-Shifter** — perturbs the *problem definition*: reframes
  "increase plaster hydrophobicity" as chemical / physical / thermodynamic /
  biological frames. Metric: **Semantic Distance** (embedding gap) + Paradigm Gap;
  classifies output TRANSFER vs NOVEL. High ΔK (opens whole fields).
- **Gradient & Asymmetry Forge** — perturbs *spatial/temporal homogeneity*:
  deliberate gradients (concentration, energy, coverage) instead of uniform mixes.
  Metric: **Heterogeneity Index** (0=uniform..1=max gradient) + incremental
  production cost. Prefers cases where validation is cheap (fast spectroscopy).
- **Catastrophe Inversion Engine** — perturbs *thinking direction*: enumerate sure
  ways to fail, then invert each into a design requirement (shrink-on-fire →
  timed-expansion). Metric: **Failure Severity** + **Invertibility Score**; nearly
  always NOVEL, and cheap to validate (failure tests are cheap).

If activated later, they slot under the Innovation Layer (13) + Combination
Discovery (16), share the Learning Priority Engine (19) for ΔK ranking, and are
governed by Principle 4 (nothing auto-validates) and the contract safety envelope.

### Architecture backlog — the Five-Space solution model + Constraint Physics

A structural refinement of how solution-discovery flows (recorded, not yet built).
Today the implicit path is `Requirements → Optimization → Formula` — too big a
jump. The refined model separates *values* from *physics* into ordered spaces,
each derived from the one above:

```
Value Space        — what the user wants (hydrophobicity, breathability, cost, fire…) — NO chemistry
   ↓ Constraint Space   — which value-pairs actually conflict, and WHY (typed constraints)
   ↓ Mechanism Space    — which mechanisms drive each value (fire → intumescence → acid/carbon/blowing)
   ↓ Material Space      — only now do materials appear (silane → Protectosil/Dynasylan…)
   ↓ Formulation Space   — ratios, sequence, process
   ↓ Innovation Space    — which constraint can be broken by a NEW mechanism (paradigm break)
```

Why it matters: the system is built on **mechanisms, not suppliers** — if BASF
exits the market, the mechanism stands and another material realises it. Materials
are chosen *last*, and only to realise a chosen mechanism.

**Constraint Physics.** Not every conflicting value-pair is "a trade-off"; each
belongs to a different world and is resolved differently. Trade-offs are typed:
**physical · chemical · process · economic · environmental · regulatory · human**
(e.g. hydrophobicity↑ vs. vapor-permeability↓ is *physical*; cost vs. performance
is *economic*; VOC vs. application is *regulatory*).

**Constraint Resolution Engine** (future). Instead of "no solution found", it
reports *which* constraint blocks: `physical_contradiction` /
`economic_contradiction` / `insufficient_knowledge` / `supplier_limitation` —
four completely different answers. This is the same discipline as the Capability
Planner's typed gap reporting (`docs/task-contract/CapabilityPlanner.md`): never a
blank "no", always *why*.

**Innovation Space** (future, high-value). When current mechanisms make a
value-pair *impossible*, the engine does not keep optimising a contradiction — it
flags **Paradigm Break Required** and searches other industries (medicine,
aerospace, nanotech, batteries, biology) for a mechanism that breaks the
constraint. This maps directly onto **FSCTM**: when Constraint Space finds no
solution in the current mechanism space, that is exactly the trigger for stage **B
(Breakdown) → N (New idea)** — stop optimising a solution that cannot exist, and
cross into a new mechanism. Governed, as ever, by Principle 4 and the contract
safety envelope (everything generated is a hypothesis).

### The Material World Model — the physics substrate (drafted on paper)

> **Now drafted as a standard** (ontology → schema → engine, in dependency order):
> `docs/material-state/MaterialWorldModel.md`. Material World Model Ontology v1.0
> (entities/relations), Material State Schema v1.0 (State + Transition, worked
> epoxy example), and the Material Transformation Engine contract (Engine Contract
> v1.1 unchanged, `reasoning.class: simulation`, `predict = 5`). Still docs only —
> no code, no simulation.

The deepest missing substrate. Today knowledge flows
`Documents → Embeddings → Graph`. But chemistry does not work like that; it works
like physics:

```
Energy → Interface → Mechanism → Structure → Properties → Performance → Failure
```

So "600°C" should not be *searched* as the string "600 degrees" — it should be
*inferred* as a cascade:

```
Energy ↑ → bond energy exceeded → polymer decomposition → gas evolution
        → char formation → porosity change → thermal-conductivity change
        → mechanical-strength change
```

That is not RAG; it is the physics of the material. Two pieces:

- **Material State Space** — a new *knowledge layer* (a peer of the 14 IKL
  layers, sitting UNDER Mechanism Space in the Five-Space model and realising
  Interface Physics / Engine 30 at the state level). Nodes = material states
  (e.g. epoxy: glassy → rubbery → chain-scission → carbonised); edges = sourced
  transitions `{ from_state, to_state, driver (energy/humidity/pressure),
  threshold, mechanism, provenance, confidence }`. Examples:
  `Silane + humidity → hydrolysis → condensation → siloxane network`;
  `Pressure → crystal rearrangement → density → elastic modulus`. Every
  transition carries provenance — **no invented chemistry** (Principle 7); every
  state change traces to a source.
- **Material Transformation Engine** — an engine (Engine Contract v1.1,
  `reasoning.class: simulation` — already in the frozen enum) that *traverses*
  the State Space to infer the cascade from `State + Energy/Environment input`.
  It **predicts**, it does not retrieve; its outputs are hypotheses/predictions
  under the same safety envelope (`emits: prediction, explanation, …` — never a
  decision), with per-step provenance and uncertainty.

Why it is the next leap: it turns every evidence modality into one model — TGA,
DSC, FTIR, XRD, SEM, patents, papers, formulations all describe the *same thing*,
`Material → Energy → Transformation → Properties`. It also completes the FSCTM
tie: a requested transformation with **no known path** in the State Space is a
*conflict* → **breakdown** → **recombination** → a candidate new mechanism
(paradigm break), exactly the "identify conflict, structural breakdown and
recombine before forming a new law" principle. This is the shift from a system
that *retrieves information* to one that *understands how a material changes*.

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

## II.5 Engine 21 — Engineering Trade-off Engine

**Status: 🟠 NEW ARCH.** In real development there is no "best", only
trade-offs. This engine builds the **trade-off map** between properties and
states every gain in the currency of its costs. Instead of "we improved fire
resistance" it says:

> "+18% fire resistance, at −6% workability, +9% cost, +VOC, +drying time."

It is the *explainability layer* over Engine 18 (which finds the Pareto front)
and Engine 2 (which compares options): 18 computes the frontier, 21 explains any
move along it in engineering terms a formulator can act on. Every stated
trade-off carries the provenance of the data points behind it.

## II.6 Engine 25 — Strategic Opportunity Engine

**Status: 🟠→🔭 NEW ARCH → FUTURE.** The mirror of a problem-finder: it hunts
*opportunities*. It fuses market → competitors → patents → regulation → trends →
gaps and returns an **Opportunity Score** with a decisive twist — the Fresco-DNA
overlay (Principle 5) flags when *"you already hold the mechanism/know-how to
enter this market."*

> Opportunity Score 92% · Low competition · High demand · Mechanism exists
> internally · Patent opportunity open.

It is the business-facing sibling of Engine 11 (which maps IP white-space) and
Engine 13 (the innovation layer that stores opportunities). Output is a ranked
set of **hypotheses**, never a committed strategy.

## II.7 Engine 27 — Scientific Visualization Engine

**Status: 🟠→🔭 NEW ARCH → FUTURE.** The users are not always chemists —
sometimes a salesperson or a customer needs to *understand why* something
happens, not just receive an answer. Most software shows **data** (tables,
charts, documents). This engine shows **mechanisms**. It turns any piece of
knowledge into a visual explanation, so "add silane" becomes *seeing* how the
silane bonds to the substrate, changes pore behaviour, and finally lowers the
wall's water uptake.

It is a **presentation/explanation layer**, not a knowledge producer: it renders
what already exists in the knowledge base and the engines. Eight views:

1. **Molecular View** — real 3-D structures, functional groups, active bonds,
   reaction zones (e.g. Silane → hydrolysis → bond formation → stone surface).
2. **Mechanism Animation** — the mechanism over *time* (e.g. APP → acid release →
   polyol melts → melamine releases gas → char expands → thermal insulation).
3. **Interface View** — what happens at an interface (Stone │ Water │ Silane │
   Pore): where water enters, where silane binds, where capillarity is blocked.
   *Direct visual front-end of Engine 20 (Interface Network).*
4. **Process Timeline** — 0 s mixing → 2 min dispersion → 10 min film formation →
   24 h curing → 6 months weathering.
5. **Fire Simulation** — temperature ramp (20 → 150 → 250 °C APP activated → 350
   char expansion → 600 protection) with the intumescent layer visibly swelling.
6. **Knowledge Evolution** — Experiment → Knowledge Event → ΔK → New Principle →
   Recommendation: *seeing how knowledge is born* (front-end of the Continuous
   Learning Loop + Industrial Memory, Engine 24).
7. **Formula Evolution** — V001 → +APP → V014 → −Melamine → V037 → +Glass Sand →
   V081 → final: a *journey*, not a table (internal formulation history).
8. **Interaction Network** — a clickable graph of materials and their effects
   (APP → Binder / Melamine / Moisture / Fire; Melamine → Expansion / Smoke /
   Density). Front-end of Engines 15 (Relationship Intelligence) + 20.

### The multi-scale zoom (the strongest idea)

A Google-Maps-style zoom through scale, and a matching semantic drill-down
through the knowledge graph:

```
Scale zoom:      Building → Wall → Plaster → Particles → Crystal → Molecule → Bond
Semantic drill:  Project → Product → Formulation → Material → Mechanism → Molecule → Bond
                 (and the reverse: Molecule → Mechanism → Property → Formulation
                  → Product → Project → Field performance)
```

The user "dives" through the levels — connecting abstract knowledge to intuitive
understanding. This is one of the platform's strongest differentiators: it shows
*mechanisms and cause→effect chains*, not just records.

### Guardrails (non-negotiable)

- **Never invent chemistry (Principle 7) applies to pixels too.** Every rendered
  structure/animation must bind to sourced data — 3-D molecules from an
  authoritative structure source keyed by CAS (Layer 3); mechanism animations
  and fire/aging simulations only from sourced mechanism/performance records.
- **Provenance & confidence are shown, not hidden (Principle 6).** A view carries
  the confidence of the data behind it; anything illustrative-but-unvalidated is
  visibly marked as a **hypothesis**, never drawn as established fact.
- **Separation is visible (Principle 5).** The zoom crosses domains — Project /
  Product / Formulation are *internal Fresco*; Material / Mechanism / Molecule
  are *external IKL*. The engine must visually distinguish external vs. internal
  vs. hypothesis and never merge them into one record.

### Design north-stars (future UX — not requirements yet)

Aspirational experience directions for Engines 27–28, captured so they are not
lost. They are *design philosophy*, not committed features, and all remain bound
by the guardrails above (nothing rendered may outrun its provenance):

- **Chronos Lens — time as texture.** Time is grabbable, not a slider: drag the
  future into the present and watch aging happen (cracks form, colour fades,
  salts bloom); drag back to synthesis. UI light-temperature shifts warm→future,
  cool→past. Turns "durability over time" into a felt dimension. (Renders only
  sourced aging/weathering data — Layer 9 + Engine 17.)
- **Bio-Mimetic feedback — a living interface.** Relevant data "breathes"
  (expands); irrelevant data softens but never disappears. Attempting a
  known-to-fail formulation meets subtle cursor resistance + a vibration (like a
  locked handle); connections glow with the *strength of evidence* (confidence).
- **Collective Consciousness — organizational mind.** Each Fresco researcher is a
  point of light whose brightness = their expertise in the current material;
  unsolved questions from many users coalesce into autonomous **Knowledge Gaps**
  (Engine 22); contradictory mechanisms (hydrophobic vs. hydrophilic) render as
  wave interference, flagging a paradox for team discussion. (Internal-domain and
  people data — governed by Principle 5 and access control.)
- **Reference Frame — no absolute values.** Never show a number without "relative
  to what". Every value/recommendation/chart declares its reference (current
  product, previous version, best Fresco formula, competitor, industry benchmark,
  literature, patent, regulatory minimum, customer target, future goal). Switching
  the reference reorganizes the whole view around the new centre — *the data
  doesn't change, its meaning does.* (Could graduate into a normative display
  principle, not just UX.)
- **Value Field — no single "best".** The user weights goals (fire, cost,
  sustainability, application ease, durability, speed) *before* analysis; the same
  formulation is ★★★★★ by fire and ★★☆☆☆ by cost. The UX face of Engines 18
  (Pareto) + 21 (Trade-off): reveal trade-offs, never hide them.
- **Decision Horizon — consequences before they happen.** Every change emits a
  visible consequence field propagating through performance/cost/workability/
  durability/risk. The UX face of the Interface Network/Physics (20/30): show
  consequences, not just results.

**Guiding meta-principle:** *"Do not design screens. Design scientific
perception."* Every component must strengthen at least one of the researcher's
four capabilities — **See · Understand · Predict · Decide** — or it earns no
place. This maps 1:1 to the engine **Capability Vector** (observe→See,
explain→Understand, predict→Predict, recommend/validate→Decide), so the same
filter governs both engines and the perception layer.

These raise the bar for the *visualization/perception* layer specifically; they
do not change any engine's contract or the knowledge model.

---

# Part II+ — Orchestration Tier (the decision layer)

*This is the tier that was missing. The engines are specialists; this tier makes
them work together. It sits **between the engines and the user**, and it is where
a knowledge base becomes a research system.*

> **Contract-first, not orchestrator-first.** The single most important step in
> this tier is *not* the Orchestrator — it is the **Engine Contract** (II+.0). An
> Orchestrator that hard-knows N engines is a liability that must be rewritten
> every time an engine is added. A **Composer** that runs anything satisfying the
> contract never changes as the engine set grows from 27 to 60. Build the contract
> first; the conductor becomes trivial and permanent. (Principle 10.)

**Status: 🟠 NEW ARCH.** Prerequisite for the Composer: enough engines exist to
be worth composing (≥ Search, Comparison, Compatibility, Substitution, Cost,
Supply-Chain) — *and* they all speak the contract.

## II+.0 Engine & Interface Contract (the foundation) + Marketplace

**Every engine is Plug & Play: stateless, and answers the same contract.**

```
Engine:
  Name:          Patent Intelligence
  Purpose:       map IP landscape for a material/mechanism
  Consumes:      Patent, Materials, Mechanisms
  Produces:      PatentAnalysis
  Confidence:    0.82
  Latency:       …
  Cost:          …
  Dependencies:  Knowledge Library, Mechanism Graph
  Failure modes: missing claims
```

- **Stateless:** an engine is `Input → Output`. It knows nothing about who called
  it or what runs next. No engine imports another; they compose only through the
  contract.
- **Typed I/O:** `Consumes`/`Produces` are named types (e.g. `PatentAnalysis`) so
  the Composer can wire engines like LEGO — output type of one = input type of the
  next.
- **Self-describing cost/confidence:** every engine advertises confidence,
  latency and cost so the Composer can plan and so answers inherit the lowest
  confidence in the chain (Principle 8).

**Engine Marketplace (the payoff).** Because engines are contract-bound modules,
new ones drop in with **zero changes** to the decision layer. Future domain
engines already anticipated: Corrosion, Concrete, Polymer, AI-Vision,
Spectroscopy, FTIR, DSC, TGA, XRD, … Each is just another module that satisfies
the contract. This is the difference between a product and a platform.

## II+.1 Engine Composer (not an Orchestrator)

Not a manager — a **composer**. The user never picks an engine. A **need is
detected**, the Composer plans a sequence of *contract-satisfying* engines, runs
them (serial where there are dependencies, parallel where independent), and
**synthesizes** a single explainable answer. Same engines, different
combinations — LEGO:

```
Question → Translator → Search → Mechanism → Patent → Trade-off → Simulation → Recommendation
Question → Failure → Knowledge-Gap → Experiment-Planner → Recommendation
Question → Supply-Chain → Alternatives → Cost → Geo → Recommendation
```

Internals — `Task → Planner → Sequence → Execute → Merge`:
- **Planner:** maps a detected need → an engine plan (DAG) by matching
  `Produces`/`Consumes` types, not a fixed pipeline and not a hard-coded engine list.
- **Executor:** runs the DAG, passing each engine's provenance forward.
- **Merger/Synthesizer:** merges outputs into one answer that inherits the
  *lowest* confidence in the chain and lists every contributing source (Principle 8).
- **Gap emitter:** any unanswered sub-question is emitted to II+.2 (Principle 9).
- Fully auditable: the plan, the engines run, and the synthesis are all logged
  (extends the existing `decision_audit_log` / research-loop machinery).

> The "Orchestrator" of earlier drafts *is* this Composer once it plans
> dynamically. The rename is deliberate: it **composes** contract-bound modules;
> it does not **manage** a known set. That is why it never needs rewriting.

## II+.2 Learning Priority Engine (Engine 19)

At any moment there are thousands of knowledge gaps. This engine answers **"what
is most worth learning *now*?"** — the difference between "run another
experiment" and "run *this* experiment."

```
1000 Unknowns → Impact → Uncertainty → Business Value → Experiment Cost → Ranking
```
*Output example:* "Running this experiment cuts uncertainty in the whole
intumescent family by 18%" — a ranked, quantified learning recommendation, not a
vague suggestion. Feeds the Composer (which gaps to chase) and Experimental
Planning (Engine 8) / DoE. This is arguably the highest-leverage meta-engine: it
directs the entire research loop's attention.

## II+.3 Interface Network Engine (Engine 20)

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

## II+.3b Interface Physics Engine (Engine 30) — Engine 20 as substrate

**Status: 🔭 FUTURE VISION** — possibly the single largest idea in the whole
architecture. Engine 20 (above) is a *data model* for interfaces. Engine 30 is
what it becomes when that model stops being one engine's concern and turns into
the **substrate every engine operates on**. The shift:

> You no longer study *materials*. You study *interfaces*.

Every component in the system — Material, Process, Equipment, Climate, Worker,
Surface, Regulation, Cost, Supply Chain — exists through its interfaces, and
**all engines read and write the same interface graph** rather than each keeping
its own private view. Compatibility, Substitution, Failure, Reliability,
Trade-off, Visualization — all become *queries over one physics of interfaces*.

This is a foundational commitment, not a feature: it says the platform's core
object is the interface, not the material. It is built late (the engines and data
must exist first), but the interface model (Engine 20 storage) should be laid
down early with this destination in mind — hence "interfaces as first-class
nodes" already appears in build-order step 2.

## II+.4 Knowledge Gap Engine (Engine 22)

Instead of "what do we know?", it asks **"what do we *not* know?"** — a coverage
heat-map across mechanisms and materials:

```
Fire        ██████████   (well studied)
Adhesion    ██████
Carbonation ██
Freeze-Thaw █            (near black-hole)
```

It surfaces which mechanisms are barely researched, which materials lack data,
and which regions of the knowledge space are "black holes". **It is the detector
that feeds Engine 19 (Learning Priority):** Gap finds the holes; Priority ranks
which hole to close first. Together they make the research plan *data-driven*
instead of intuition-driven.

## II+.5 Autonomous Experiment Planner (Engine 23)

Not ordinary DoE — it optimizes **Knowledge ROI**:

```
Knowledge ROI = Expected ΔK ÷ Experiment Cost ÷ Experiment Time
```

and ranks the queue:

> Experiment 17 · expected ΔK 0.84 · 8 h · ₪1,200 · ★★★★★

So instead of running dozens of experiments, the system proposes the
*scientifically optimal order*. It is Engine 8 (Experimental Planning) given an
explicit objective function, driven by Engines 19 + 22, and it is the bridge from
*decision* to *experiment* in the loop.

## II+.6 Industrial Memory Engine (Engine 24)

The hardest R&D problem: **knowledge leaves when people leave.** This engine
captures the *why*, not just the *what*:

```
Decision → Reason → Experiment → Outcome → Lesson Learned
```

— who changed what, why, what they expected, what actually happened, what was
learned. Ten years later you can reconstruct *why a decision was made*, not just
what the formulation was. It is the active-capture realization of Layer 14
(Knowledge Events / evolution chains) and the raw material the Meta-Learning
Engine consumes. (Internal-domain data — governed by Principle 5.)

## II+.7 Meta-Learning Engine (Engine 26) — the apex

**Status: 🔭 FUTURE VISION** (depends on all other engines + years of memory).
This engine does not learn chemistry. **It learns how the organization discovers
knowledge.** Over years it analyses:

- which *types* of experiments led to breakthroughs;
- which mistakes recurred;
- which development strategies succeeded;
- which material combinations almost always failed;
- which researchers/teams excel at spotting particular mechanisms.

So the platform stops merely improving *products* and starts improving the
*innovation process itself*. This is the deepest competitive moat in the whole
architecture: it cannot be copied, because it is built from **this
organization's** accumulated history and learning. Everything else can be
rebuilt from public sources; this cannot.

## II+.8 Visual Reasoning Engine (Engine 28)

**Status: 🔭 FUTURE VISION.** Not graphs, not tables — **visual thinking.** When
you ask *"why did the plaster fail?"*, the system doesn't return a paragraph; it
builds the reasoning as a chain you can *see*:

```
Stone → Moisture → Salt → Binder → Crack → Failure
```

You watch the inference form. It is the sibling of Engine 27: **27 shows the
mechanism/molecule (what & how); 28 shows the reasoning/causal path (why).** It
renders the Composer's own inference trace (II+.1) plus Failure (Layer 12) and
Interface (Engine 20/30) chains — making the system's reasoning inspectable, not
a black box (Principle 6).

## II+.9 Knowledge Replay Engine (Engine 29)

**Status: 🔭 FUTURE VISION.** Because knowledge is append-only and every record
carries provenance, the history can be **replayed** — forwards or backwards:

```
Failure → Decision → Experiment → Formulation → Knowledge Event → Evidence → Observation
Observation → … → Market Success        (reverse)
```

A powerful learning and onboarding tool: a new engineer can "run the tape" of how
a product came to be, or trace a field failure back to the decision that caused
it. It is a traversal of Industrial Memory (Engine 24) + the version history —
it creates nothing, it replays what already exists.

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
   → Engine Contract + Composer → Learning Priority Engine → Interface Network Engine
   → Decision → Experiment → Knowledge Event → ΔK
   → (human-gated validation) → Industrial Knowledge Library   ⟲
```

The system becomes smarter after every project — **only through human-gated
validation**, never auto-promotion. What was a static repository becomes a system
that *manages the evolution of knowledge over time*.

## III.2 Platform capability lifecycle

At full maturity the platform is an **operating system for industrial R&D**. Its
capabilities form a lifecycle, each stage owned by parts of the architecture:

| Stage | Owned by |
|-------|----------|
| Knowledge Acquisition | Ingestion pipeline (II.3) + internal feeds |
| Knowledge Organization | Knowledge base / graph (Part I) + Interface Network (20) |
| Knowledge Validation | Confidence Engine (II.1) + human-gated validation |
| Knowledge Reasoning | Engines 2–6, 15; Semantic Translator (II.2) |
| Knowledge Discovery | Engines 11, 13, 16; Knowledge Gap (22) |
| Decision Support | Engine Composer (II+.1, over the contract II+.0) + Trade-off (21) |
| Experiment Planning | Learning Priority (19) + Autonomous Experiment Planner (23) |
| Knowledge Creation | Continuous Learning Loop (III.1) + Industrial Memory (24) |
| Business Opportunity | Strategic Opportunity (25) + Strategic Landscape (11) |
| Comprehension / Explanation | Scientific Visualization (27) + Visual Reasoning (28); Knowledge Replay (29) |
| Foundational substrate | Interface Physics (30) — the interface graph all engines share |
| *(meta)* Process improvement | Meta-Learning (26) — learns the lifecycle itself |

## III.3 Long-term platform

A continuously evolving industrial intelligence platform integrating chemistry,
engineering, economics, regulation, field performance, supply-chain resilience,
experimental science and organizational knowledge into a **single explainable
system**. Purpose: shorten R&D cycles, reduce engineering uncertainty, preserve
organizational knowledge, and generate new validated insights over time.

Realizing it depends on: a populated knowledge base (Part I at scale), the
reasoning engines (Part II), the **Engine Contract + Composer** that compose them
(Part II+.0–1), and the predictive/discovery engines (7, 13, 14, 16, 17) maturing
on top of real data. The contract is what makes it a *platform* (engines are
modules) rather than a program; the Composer is what makes it a *decision* system
rather than a search box.

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

## V.1 Where we are — achieved vs. vision (kept strictly separate)

**Achieved (real, in the repo):**
- **Knowledge base:** ✅ IKL Layers 1–13 (14 partial); provenance, versioning,
  Fresco separation, semantic search, bulk import — running.
- **A shared language (standards locked & schema-validated against real
  instances):** Engine Contract **v1.1** (+ 4 engine instances spanning
  retrieval/evidential/generative/recommendation), Capability Ontology v1.0,
  Scientific Task Contract v1.0, Decision Workspace v1.0, Capability Planner v1.0.
- **The architecture runs at one point:** ✅ **G7** — `runSearch(input, ctx) →
  Result` executes under Engine Contract v1.1 (Task→Capability→Engine→Result is
  real, tested, behaviour-preserving). See `iklSearchEngine.js`.
- **Epistemic boundary:** ✅ the Decision Boundary is structural — no engine can
  emit a decision (validated + negative-tested).

**Vision (paper or unbuilt):**
- Engines 2–30 exist only as **paper contracts** (Knowledge Event, Combination
  Discovery, Recommendation) — only Search *runs*.
- 🟠 The **Composer/executor** (planner is paper; nothing executes a multi-node
  plan yet), IKL ingestion of real data, Scientific UX.
- 🔭 Interface Physics (30), Meta-Learning (26), Industrial Memory, the Five-Space
  model, and the **Material State Space + Material Transformation Engine** (the
  physics substrate — the proposed next leap).

Delivered artifacts (in `matriya-back`): `iklModels.js`, `iklEndpoints.js`,
`iklVectorStore.js`, `iklSearchEngine.js`, `sql/industrial_knowledge_library.sql`,
`scripts/seed-ikl-vocabulary.js`, `scripts/test-run-search-g7.mjs`, mounted at
`/ikl`; plus the standards under `docs/engine-contract/` and `docs/task-contract/`.

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
5. **Contract-first orchestration** *(🟠, II+.0–1)* — **before** any conductor:
   a. **Engine Contract** (II+.0) — retrofit Engine 1 (Search) and every new
      engine to the stateless, typed contract; this is the pivot that makes the
      rest permanent.
   b. **Composer** (II+.1) — a generic planner→execute→merge over anything that
      satisfies the contract, built on the existing `decision_audit_log`/
      research-loop. *Not* an Orchestrator that hard-knows the engines.
   c. **Visual Reasoning (28)** and **Knowledge Replay (29)** — make the
      Composer's reasoning and the history inspectable.
   Rationale: with the contract in place, the "Orchestrator" step never has to be
   rewritten — 27 engines today or 60 in two years run through the *same* Composer.
   The old "Orchestrator-first" plan is explicitly rejected here.
6. **Research-direction meta-engines** *(🟠, II+)* — Learning Priority (19),
   Knowledge Gap (22) → feeds 19; Autonomous Experiment Planner (23) on Engine 8;
   Industrial Memory (24) capturing decision→outcome→lesson. Closes the loop.
7. **IKL-backed QA** integrated with the existing kernel/RAG while preserving
   separation — the Composer becomes the answer path.
8. **Discovery & strategy** *(🟠/🔭)* — Strategic Landscape (11, II.4), Strategic
   Opportunity (25), Trade-off (21), Supply-Chain Shock (12), Combination
   Discovery (16), plus the validation workflow, and the **Engine Marketplace**
   opening to new domain engines (Corrosion, Concrete, Polymer, spectroscopy:
   FTIR/DSC/TGA/XRD, AI-Vision).
   *Visualization (27) can start early and grow in parallel:* the Molecular View
   is achievable as soon as raw materials carry CAS (Layer 3); the Interaction
   Network and Formula/Knowledge-Evolution views follow their underlying engines.
9. **Predictive, substrate & platform** *(🔭)* — Performance Prediction (7),
   Reliability & Aging (17), Multi-Objective Optimization (18), Digital Twin (14),
   Cross-Industry Analogy (13), **Interface Physics (30)** as the shared
   substrate, the closed Continuous Learning Loop (III.1), and finally
   **Meta-Learning (26)** — built last, once there is a history to learn from.

## V.3 Requirement → status quick index

| Bucket | Implemented | Partial | Fits arch | New arch | Future |
|--------|-------------|---------|-----------|----------|--------|
| Knowledge base (Layers 1–14 + cross-cutting) | Layers 1–3,5–12; provenance; versioning; separation; confidence storage | Layers 4, 13, 14 | hierarchy depth, mechanism sub-typing, review-status field | Digital assets (patterns, decision trees, knowledge events, evolution chains) | — |
| Engines (1–30 + translator + confidence + ingestion) | — | Engine 1 | Engine 2; Confidence Engine; Engines 4/5/15 (storage/read side) | Engines 3,6,8,10,11,12,19,20,21,22,23,24,25,27; Semantic Translator; ingestion pipeline | Engines 7,9,13,14,16,17,18,26,28,29,30; Engine 11 strategic layers; Engine 27 advanced views |
| Orchestration tier (II+) | — | — | — | **Engine Contract (II+.0)**; Composer (II+.1); Learning Priority (19); Interface Network (20); Knowledge Gap (22); Autonomous Experiment Planner (23); Industrial Memory (24) | Engine Marketplace; Interface Physics (30); Visual Reasoning (28); Knowledge Replay (29); Meta-Learning (26); closed-loop autonomy |
| Vision | — | learning-loop substrate | — | — | Continuous Learning Loop; platform; capability lifecycle |

---

*This document is methodology-first. Implementation details and API contracts
for the built portions live in `INDUSTRIAL-KNOWLEDGE-LIBRARY.md`. When an engine
moves from spec to build, add its contract there and flip its status here.*
