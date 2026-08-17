# MATRIYA — Canonical Product Inventory

> ## ⛔ THE BINDING RULE — REVEAL-BEFORE-ADD
> Every session, agent, or developer that intends to add ANY capability, screen,
> endpoint, table, or module MUST follow, in order:
>
> **`READ INVENTORY → SEARCH EXISTING → CLASSIFY → REUSE → ONLY THEN BUILD`**
>
> 1. **READ INVENTORY** — read this document first. It is the canonical map.
> 2. **SEARCH EXISTING** — grep the repos listed below for the capability.
> 3. **CLASSIFY** — `EXISTS & VISIBLE / EXISTS & HIDDEN / PARTIAL / DUPLICATE / DEAD / TRULY MISSING`.
> 4. **REUSE** — visible → use it; hidden → surface it; partial → extend it; duplicate → merge, don't add a third.
> 5. **ONLY THEN BUILD** — new code is justified only for `TRULY MISSING`.
>
> After any change that adds/removes/surfaces a capability — **update this document in the same PR.**
>
> **BINDING SESSION RULE — Production Progress:** every session that changes
> MATRIYA must append a session entry to `data/production-progress.json`
> (rendered at `GET /progress`) BEFORE the session closes, in the same PR.
> Stages are strict: `CODED < MERGED < DEPLOYED < LIVE_VERIFIED` — a capability
> may never be presented as an improvement while only CODED. If nothing really
> changed in production, the entry is `no_production_change: true`
> ("NO PRODUCTION CHANGE").

_Last verified: 2026-08-17 (full REVEAL-BEFORE-ADD audit). Counts measured from code on `main` branches._

---

## 1 · Systems

> ### ⚠️ PRODUCTION SURFACE (verified 2026-08-17)
> **The live product at `matriya-workspace.vercel.app` is deployed from
> `shoshan19-prog/Matriya-System-Project#main`** (last production commit
> `196befb`, Aug 3) — **NOT** from `matriya-front-`. `matriya-front-` is a
> development UI whose merges do not reach the workspace domain. Any
> user-facing surface (including Production Progress) must be implemented in
> **Matriya-System-Project** and shipped through its existing pipeline.
> NOTE: that repo is currently OUTSIDE this session's repo scope — add it to
> the session's repository access before working on it.

| System | Role | Verified scale |
|---|---|---|
| **matriya-back** (this repo) | Research/RAG engine + admin & governance | ~60 endpoints; researchLoop (analysis→research→critic→synthesis), researchGate, detectGaps, DOE engine, audit, observability |
| **matriya-front-** | Worker UI — 5 live tabs | MRI (landing) · Upload · Ask · Search("מחקר") · Admin (files/users/history/integrity/global) |
| **maneger-back-** | Lab Control System (separate app; API-only link to MATRIYA) | 108 endpoints; 28 tables (projects, lab_experiments, runs, tasks, milestones, materials, audit_log, research_sessions…) |
| **maneger-front-** | Lab/PM UI | 12 screens + 4 modals (incl. project Overview + Lab analysis suite) |
| **matriya-system** | ⚠️ EMPTY SCAFFOLD (all service files 0 bytes) | do not build on |

## 2 · Live & VISIBLE surfaces (reuse first)

- **Search "מחקר"** (matriya-front): runs the research loop (`POST /api/research/run`), critic verdict (sufficient/gap/contradiction), PARTIAL_EVIDENCE what_exists/what_missing, kernel Evidence/Pattern/Conclusion, `POST /agent/contradiction·risk`.
- **FormulaCheck** (inside Search): `POST /analysis/formula` — past-experiment outcomes before running a new one. CRITICAL surface.
- **Ask Matriya** + Upload ask panel: `POST /ask-matriya` (⚠ duplicate scope — shared client & cache).
- **Morning MRI**: `GET /mri` — daily triage landing.
- **Admin**: files · users · history (Q&A demand signal) · **integrity/B-Integrity** (`/admin/recovery/dashboard·oracle`, `/admin/reports/value-summary`, `/admin/fil/warnings`, violations resolve) · global metrics.
- **maneger Lab screen**: `/api/projects/:id/analysis/contradictions · failure-patterns · research-snapshot · formula-validate · insights · similar-experiments · relations · formulation-intelligence` + `guard/check` + `/api/matriya/insights/:experimentId`.
- **maneger project fabric**: `projects` (+members, join-request approve, tasks, milestones, chat, docs/SharePoint).

## 3 · EXISTS & HIDDEN (surfacing only — do NOT rebuild)

| Capability | Endpoints (matriya-back) |
|---|---|
| **DOE / Next-Experiment engine** | `/admin/doe/export`, GET/POST `/admin/doe/designs`, GET/PATCH/DELETE `/admin/doe/designs/:id`, **POST `/admin/doe/designs/:id/execute`** (runs researchLoop per factor row) |
| **Audit trail (Evidence)** | `GET /api/audit/decisions`, `GET /api/audit/session/:sessionId/decisions` |
| **Observability / gap-gates** | `/api/observability/dashboard·sem·gates`, GET/POST `/api/observability/noise`, `PATCH /api/observability/decision/:id/feedback` |
| **Research session read/advance (Human Decision)** | `GET/PATCH /research/session/:id`, `GET /research/staging-proof` |
| **Snapshots** | POST/GET `/admin/snapshots`, GET `/admin/snapshots/:id`, POST `…/restore` |
| **Justification templates** | GET/POST `/admin/justification-templates`, PATCH/DELETE `:id` |
| **Recovery extras** | `/admin/recovery/rules`, `/admin/risk-oracle`, POST `/admin/recovery/rollback`, violations list/create/bulk-resolve |
| **Insights / experiment sync** | `GET /insights/experiment/:experimentId`, `POST /sync/experiments` |
| **World Knowledge (live provenance layer)** | `POST /world/ingest` (requires source_id + citation; never enters the OpenAI file_search store), `GET /world/search` (explicit world-only retrieval with provenance), `GET /world/status` (counts by source_class). Isolation: default Fresco retrieval + file enumeration exclude `source_class='world_external'` (`lib/worldKnowledge.js`, `scripts/check-world-knowledge.js`) |
| **Live Fresco↔World comparison** | `POST /world/compare` — scientific comparison of one Fresco claim vs one World claim via the proven contracts (`lib/dualProvenanceContract.js` + `lib/comparabilityContract.js`, ported from PRs #7/#8): comparability gate BEFORE any value verdict → `AGREE / CONFLICT / FRESCO_ONLY / WORLD_ONLY / NOT_COMPARABLE`, full per-side provenance, isolation refusals are 400s (`scripts/check-live-comparison.js`) |
| **Production Progress monitor** (⚠️ built in matriya-back/front which do NOT serve the workspace domain — PARKED until re-implemented inside Matriya-System-Project; the record schema, stage ladder and self-test pattern are the reusable contract) | `GET /progress` (HTML) + `GET /progress.json` — the canonical production change monitor: per-session record (`data/production-progress.json`, binding rule above) + runtime self-tests in the serving process (gate self-test, DB/world corpus counts, deploy SHA). Stage ladder CODED/MERGED/DEPLOYED/LIVE_VERIFIED computed at request time (`lib/productionProgress.js`, `scripts/check-production-progress.js`) |

## 4 · DEAD (do not build on, remove-candidates)

- matriya-front `InfoTab.js` — orphan, never imported.
- matriya-front `ManagementLabTab.js` + `managementApi/managementConfig` — `lab` route is bounced to `mri`.
- `public/cockpit/` — static illustrative mock; not wired; `cockpit:export` script does not exist.

## 5 · TRULY MISSING (the only justified new development)

1. ~~World Knowledge (live)~~ — **BUILT** (world-knowledge PR): live `world_external` provenance layer with ingest/search/status endpoints and default-Fresco isolation. Reuses the proven Dual-Provenance contract; the comparability gate (`poc/comparability.js`, PR #8) is the next integration step before any Fresco↔World verdict.
2. **Ranked Critical-Gap object** — no system computes or stores an impact-ranked knowledge gap per project. (Must consume BOTH provenances — build only after World corpus is populated.)
3. *(Field-level)* `projects.goal` — maneger `projects` has only `description`. (`project_record` does not exist anywhere — do not invent it.)

## 6 · Project Research page — REVEAL-BEFORE-ADD verdict (2026-08-17)

| Block | Status | Action |
|---|---|---|
| 0+① Project identity / goal | EXISTS & VISIBLE (goal field PARTIAL) | reuse maneger `projects` |
| ② Fresco knowledge | EXISTS & VISIBLE | reuse Search/Ask/FormulaCheck + maneger Lab |
| ③ World knowledge | EXISTS & HIDDEN (backend live, no UI yet) | populate corpus, then surface |
| ④ Unknown / gaps | PARTIAL | project-scope surfacing of detectGaps / what_missing |
| ⑤ Contradictions | EXISTS & VISIBLE (**DUPLICATE ×2**) | unify to one surface |
| ⑥ Critical ranked gap | **TRULY MISSING** | new dev |
| ⑦ Evidence / audit | PARTIAL (audit HIDDEN) | surface audit; provenance tagging is part of ③ |
| ⑧ Next experiment / DOE | EXISTS & HIDDEN | surface the DOE engine |
| ⑨ Human decision | EXISTS & HIDDEN | reuse `PATCH /research/session/:id` as GO/ITERATE/STOP (membership-approve is NOT this gate) |

**Score: build 2, surface 4, reuse 3. Do not build 9.**

## 7 · Known duplicates (merge candidates — never add a third)

- Ask panel ×2: `AskMatriyaTab` ↔ `UploadTab` ask (same `POST /ask-matriya`, shared cache).
- File list ×3: `GET /files/detail` (Upload/Ask/Search) vs `GET /admin/files` (Admin files + users picker).
- Contradictions ×2: matriya `POST /agent/contradiction` ↔ maneger `GET /analysis/contradictions`.
- Admin `global` counters ⊂ `integrity` dashboard.

## 8 · Provenance contracts (now LIVE)

- **Dual-Provenance contract** — LIVE at `lib/dualProvenanceContract.js` (ported verbatim from PR #7): `source_class ∈ {fresco_internal, world_external}` + `source_id` mandatory; same-provenance pooling refused.
- **Scientific-comparability gate** — LIVE at `lib/comparabilityContract.js` (ported verbatim from PR #8): 10 critical conditions; missing/mismatched ⇒ `NOT_COMPARABLE` (never a false CONFLICT). Wired into `POST /world/compare`.
- PRs #7/#8 remain open as the original proof-record of these contracts.
- Proven on real data (`scripts/check-live-comparison.js`): Fresco EXP-LEG-044 (67 min, custom ramp, conditions unrecorded) vs Oğuz et al. FSJ 153 (2025) 104367 (84 min, EN 1363 flat plate) → `NOT_COMPARABLE` with naive `CONFLICT` suppressed; matched-condition fixtures → `AGREE`/`CONFLICT`.
