# KRL ↔ Retrieval Router — Authority Contract

**Status: standard + runnable boundary suite (docs + tests).** A contract of
**authority**, not of technology: it defines *who owns which query*.

- **KRL** identifies semantic intent — entities and relations.
- **Retrieval** executes data operations — lookup, filter, rank, aggregate
  (`ragService` / SQL / RAG).

The boundary is **intent**, not phrasing:

```
KRL identifies semantic intent.
Retrieval executes data operations.
```

Harness: `npm run test:krl-router`. Logic: `scripts/krl-router.mjs`
(`classifyIntent`, `detectAggregation`, `assertLawKRLBoundary`). Corpus:
`docs/krl/boundary-questions.json`.

## The router — three lanes + review

```
User Query
   │
   ▼
Intent Classifier
   ├── Relation Intent     → KRL
   ├── Aggregation Intent  → Retrieval / SQL / RAG
   ├── Hybrid Intent       → KRL → Retrieval
   └── Ambiguous           → REVIEW / Clarification
```

The **Hybrid** lane is the key addition: a real question can carry *both* a
relation and an aggregation, and must not fall to one side by accident.

| Query | Intent | Flow |
|-------|--------|------|
| "באיזה פרויקטים השתמשו ב-APP?" | relation | KRL (APP ↔ Project) |
| "מה אחוז ה-APP הגבוה ביותר?" | aggregation | Retrieval — MAX(APP%) |
| "באיזה פרויקט היה אחוז ה-APP הגבוה ביותר?" | **hybrid** | KRL (Project ↔ APP%) → Retrieval MAX |

A **hybrid** is detected either by a relation trigger *plus* an aggregation, or by
a **relational grouping** — aggregating a *container* entity (project/supplier/
product) **by** a material/second entity (e.g. "top 3 projects by silicate
content", "מיין את הפרויקטים לפי אחוז APP").

## The Guard — by intent, not regex

Aggregation is detected by **operation concept**, each with bilingual triggers, so
semantic aggregations are caught without fixed English keywords:

`MAX · MIN · AVG · COUNT · TOP · RANK · ORDER · FILTER`

Example: *"איזה פרויקט מוביל בכמות APP?"* has no "highest", yet the Guard flags
`TOP`/`COUNT` (from "מוביל", "כמות") → it is (correctly) a **hybrid**. This is
heuristic-by-design (documented); an embedding classifier can replace the trigger
sets later **without changing the contract**.

## LAW-KRL-BOUNDARY-001 (enforced)

```
KRL may identify entities, relations, and semantic intent.
KRL must never execute aggregation, ranking, filtering, or statistical operations.
Those operations belong to the Retrieval layer.
```

`assertLawKRLBoundary(plan)` rejects any plan step where `layer === 'KRL'` carries
an aggregation/ranking/filter/statistics operation. The suite verifies the law
holds for **every** router-produced plan, and a **bite test** confirms it rejects a
hand-crafted plan that puts `MAX` on KRL.

## Boundary suite — the authority contract as tests

Four groups (bilingual, 8 each = 32) define ownership; passing them *is* the
contract:

| Group | Target | Meaning |
|-------|--------|---------|
| Pure Relation | KRL | entities/relations only |
| Pure Aggregation | Retrieval | data operations only |
| Hybrid | KRL → Retrieval | relation *and* aggregation |
| Ambiguous | REVIEW / Clarification | intent unclear — ask, don't guess |

## Honest limits

- Trigger-based concept detection is lexical + bilingual, not a learned classifier —
  documented, and swappable behind the same `classifyIntent` contract.
- The router returns a **routing decision / plan**, not data — it does not itself
  call KRL or `ragService` (contract-first; wiring is a follow-up).
- Entity typing (containers/materials) is a small illustrative set, extensible.

## Agreed decisions (recorded)

- ✅ keep the aggregation-to-Retrieval routing via the router (KRL never aggregates);
- ✅ add the third **Hybrid** lane so mixed queries don't misroute;
- ✅ Guard by **intent** (operation concept), not fixed regex;
- ✅ do not merge until the four-group boundary suite passes (it does: 32/32).
