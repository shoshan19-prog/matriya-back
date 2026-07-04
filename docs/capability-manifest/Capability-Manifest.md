# MATRIYA — Capability Manifest (ready for wiring, not rebuilding)

**Purpose:** an exact catalogue of every capability that already exists in the
repos I can access (`matriya-back` + IKL runtime), each with **what it does ·
input · output · how it connects to the product**. When the product repo is added,
the first task is to *connect* these — not rebuild them.

**Two kinds of capability:**
- **Runtime** — live, DB/HTTP-backed (IKL Search, RAG, Research Gate, Integrity).
  Connect directly (call the export / hit the endpoint).
- **Pure engine** — deterministic functions over inputs (MBM, KRL, Failure KB,
  Knowledge layers). Connect behind an endpoint/adapter via the G7 DI pattern
  (`fn(input, ctx)`), no DB coupling.

The product flow every capability maps onto: **open project → identify → connect
relevant knowledge → filter to what matters → suggest next action → update on new
knowledge.**

---

## 1. Retrieval & Knowledge Access (runtime — product-facing)

| Capability | Module | Does | Input | Output | Connect to product |
|---|---|---|---|---|---|
| **IKL Search Engine** | `iklSearchEngine.js` · `runSearch(input, ctx)` | Semantic search over the Industrial Knowledge Library (provenance-based). Engine-Contract v1.1 compliant. | `{query\|q, layer?, filters?}`, `ctx` (injected deps) | `Result` (observations/evidence, ranked, with provenance) | On project open → run against project entities → returns relevant IKL records. **Step: connect knowledge.** |
| **RAG Service** | `ragService.js` · `search(query, nResults, filterMetadata)` · answer+snippets | Vector retrieval + ranked snippets + grounded answer (OpenAI file-search fallback), domain-filtered. | query, nResults, metadata filter | ranked results / `{answerText, snippets}` | Project Q&A + "show only relevant" over docs/TDS/SDS. **Step: filter to relevant.** |
| **IKL Vector Store** | `iklVectorStore.js` · `indexRecord`, `getIklVectorStore`, `recordToText` | Index/query pgvector records per IKL layer. | layerKey, record | vector id / matches | Auto-index new project knowledge; powers search. **Step: update on new knowledge.** |
| **IKL REST API** | `iklEndpoints.js` (router) | `/ikl/overview·/sources·/search·/graph/mechanisms·/graph/relationships·/connections·/reindex·/:layer/bulk` | HTTP (auth/admin) | JSON | The direct surface the product calls per project. **Step: connect + display.** |

## 2. Governance & Traceability (runtime)

| Capability | Module | Does | Input | Output | Connect to product |
|---|---|---|---|---|---|
| **Research Gate (FSCTM)** | `researchGate.js` · `validateAndAdvance(sessionId, stage, userId, opts)` | Enforces K→C→B→N→L, no skip; Kernel v1.6 (breakdown, fail-safe, data anchors, L-gate). | session, stage, opts | advance/deny + audit | Every project action passes the gate → provenance-safe progression. **Step: suggest next action (gated).** |
| **Integrity Monitor** | `integrityMonitor.js` · `runIntegrityCheck`, `createViolation`, `runAfterCycle` | Detects B-integrity violations; locks the gate on breach. | sessionId, metrics | violation / snapshot | Guards project state; surfaces "what's wrong". **Step: governance.** |
| **Attribution / Pre-LLM gate** | `lib/answerAttribution.js`, `check-pre-llm-gate`, `check-answer-binding` | Binds every answer to its evidence; blocks unsupported generation. | retrieval + answer | sources / block | Traceability per project answer. **Step: traceability.** |

## 3. Authority Router — KRL (pure)

| Capability | Module · export | Does | Input | Output | Connect to product |
|---|---|---|---|---|---|
| **Intent classifier** | `krl-router.mjs` · `classifyIntent(query)` | Routes a query: Relation→KRL · Aggregation→Retrieval · Hybrid · Ambiguous. Guard by intent + `assertLawKRLBoundary`. | query string | `{intent, aggregationOps, plan}` | Every project query → correct capability. **Step: connect knowledge (dispatch).** |
| **Executor** | `krl-executor.mjs` · `route(query, ctx)` · `executePlan(plan, query, ctx)` | Runs the plan through injected `{krl, retrieval}`; runtime LAW enforcement. `retrievalFromRagService()` lazy adapter. | query, `ctx` adapters | `{intent, steps, answer}` | The conductor that turns a project question into an answer via existing layers. **Step: knowledge→action.** |

## 4. Material Behavior Model — scientific reasoning (pure)

| Capability | Module · export | Does | Input | Output |
|---|---|---|---|---|
| Invariants | `mbm-invariants.mjs` · `checkInvariants(doc)` · `computeCoverage(doc)` | 5 physical invariants + coverage gate | MBM doc | per-invariant verdict / coverage |
| Reliability | `mbm-reliability.mjs` · `modelReliabilityIndex(doc, ids)` · `transitionConfidence` · `explainTransition` · `evidenceSensitivity` | MRI, confidence, weakest-link, which experiment helps | doc, path ids | `{mri, weakest, steps}` |
| Alt-paths | `mbm-alt-paths.mjs` · `generatePaths(doc, from, to)` | all valid mechanisms, ranked | doc, endpoints | ranked paths |
| Uncertainty | `mbm-uncertainty.mjs` · `attributeUncertainty(doc, ids)` | why uncertain → modelGap/evidence/coverage/weakLink + lever | doc, ids | components + recommendation |
| Info-gain | `mbm-info-gain.mjs` · `informationGain(doc, ids)` | value each experiment (ΔMRI, per-component, cost/time) | doc, ids | ranked candidates |
| Planner | `mbm-experiment-planner.mjs` · `planExperiments(doc, ids, budget)` | best experiment portfolio under budget | doc, ids, budget | portfolio + remaining gaps |
| Calibration | `mbm-calibration.mjs` · `calibrate(records)` | predicted vs observed; bias by type/component | records | calibration report |
| Learning | `mbm-learning.mjs` · `learnCorrections(report)` | correction factors from bias | calibration report | correction model |
| Tension map | `mbm-tension-map.mjs` · `tensionMap(doc)` | model-wide stable/tension/contradiction/gap | doc | map + hotspots |
| Epistemic | `mbm-epistemic.mjs` · `epistemicState(doc, ids)` | Hypothesized/Corroborated/Confirmed/Refuted/Undecidable | doc, ids | state |
| Readiness | `mbm-readiness.mjs` · `researchReadiness(doc, opts)` | is the model ready for real data | doc, paths, calibration | RRI + weakest dim |
| Contradiction memory | `mbm-contradiction-memory.mjs` · `contradictionMemory(events)` | keep refutations as knowledge | events | ledger + unstable regions |
| Evidence aging | `mbm-evidence-aging.mjs` · `ageEvidence(ev, now)` | provenance-weighted trust (freshness/replication) | evidence, year | adjusted tier |
| Discovery | `mbm-discovery.mjs` · `discoveryOpportunities(doc)` | where new knowledge is most likely | doc, industrialValue | ranked opportunities |

**Connect to product:** given a project's material/formulation, these turn IKL/RAG
evidence into **mechanisms, uncertainty, next experiment, and readiness** — i.e.
knowledge → action. Wire behind `/project/:id/reasoning`.

## 5. Failure Knowledge Base (pure)

| Capability | Module · export | Does | Input | Output |
|---|---|---|---|---|
| Failure→MBM pilot | `failure-mbm-pilot.mjs` · `runPilot(mbm, corpus)` | yields competing mechanisms / better experiments / ΔK | mbm, failure corpus | yields + verdict |
| Pattern engine | `failure-pattern-engine.mjs` · `failurePatterns(cases)` | recurring failure motifs | cases | motifs |
| Negative knowledge | `failure-pattern-engine.mjs` · `negativeKnowledge(cases)` | anti-condition boundaries (FSCTM) | cases | boundaries per domain |

**Connect to product:** on a project → "has a similar system failed here? which
assumption breaks?" — surfaces risk + a targeted experiment.

## 6. Knowledge Layers (pure)

| Capability | Module · export | Does |
|---|---|---|
| Phase diagram | `knowledge-phase.mjs` · `phaseOfEdge`, `legalTransition`, `placeOnDiagram` | knowledge as phases + no-jump law |
| Knowledge energy | `knowledge-energy.mjs` · `knowledgeEnergy`, `compareProjects` | effort per ΔK; compare projects on efficiency |
| Transfer (KTE) | `knowledge-transfer.mjs` · `signatureOf`, `matchSignatures` | structural-signature transfer candidates (never conclusions) |

## 7. Ingestion & First Flight (pure — the safe on-ramp for real data)

| Capability | Module · export | Does |
|---|---|---|
| Ingestion gates | `ingestion-design-check.mjs` · `evaluateIngestionRequest(req)` | G1–G6: human, provenance, evidence, anchors, mapping, dual sign-off |
| Gated flight | `p0-1-gated-flight.mjs` · `gatedFlight(...)` · `passStop(...)` | run reasoning only if gates clear; PASS/STOP verdict |
| First flight | `first-flight.mjs` · `runFirstFlight(...)` · `driftMonitor(...)` | classify Observation/Context/Surprise/Artifact; co-pilot; report |

**Connect to product:** the pipeline that turns a real document/measurement into
provenance-bound project knowledge — with human sign-off.

## 8. Cockpit (projection UI)

| Capability | Module | Does |
|---|---|---|
| Cockpit exporter | `scripts/export-cockpit-snapshot.mjs` | projects the engines into a decision-oriented snapshot + static site |

---

## How this connects to the product (the wiring plan, not new code)

Per your priority order — each step is **orchestration of the above**, zero new layers:

1. **Material Library = Source of Truth** → IKL Search + IKL Vector Store + IKL API
   (§1) become the canonical material record the project reads from.
2. **Auto-connect World Knowledge per project** → on project open, `classifyIntent`
   (§3) dispatches to IKL/RAG (§1); results filtered by relevance.
3. **SharePoint** → an ingestion source feeding G1–G6 (§7) → indexed by IKL Vector
   Store (§1). (Adapter only — no new capability.)
4. **Project Home = main work screen** → the KRL executor (§3) assembles: relevant
   knowledge (§1) + reasoning (§4) + failure risk (§5) + next action (Gate §2),
   rendered like the Cockpit (§8).
5. **Cleanup** → anything in the repos not referenced by §1–§8 is a removal
   candidate (the audit surfaces dead code).

**The one thing needed to execute:** the product repo added to this session — then
step 4 (Project Home) wires these exports/endpoints in. Until then, every
capability above is documented, tested (30/30), and **ready to connect**.
