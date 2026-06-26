# Law Graph — the persistent core of knowledge evolution

The Law graph turns MATRIYA from an analysis engine into a system that
**accumulates knowledge over time**. The atomic unit is the **Law**
(relation + domain of validity + evidence for/against + breakdown history).
New direction is proposed **only** after a structured breakdown — never on a
single anomaly. This is FSCTM made durable: **K → C → B → N → L**.

## Data model (Sequelize → Postgres/Supabase, auto-created by `sync`)

| table | role |
|---|---|
| `laws` | relation `y ≈ a·x + b`, tolerance, noise σ, status (`active`/`broken`/`superseded`), version, `parent_law_id` (successor lineage) |
| `law_domains` | the law's domain of validity — **only** the input variable `x_key` (+ explicitly scoped covariates); the law is assumed *invariant* over all other features |
| `law_evidence` | every checked experiment, labelled `explained` / `contradiction` / `out_of_domain`, with residual |
| `breakdown_events` | a structured failure: feature, threshold, direction, bias, sign-consistency, failing ids |
| `gap_recommendations` | the **one decisive experiment** that resolves a breakdown, with rationale |

## Endpoints (all `requireAuth`)

| method | path | does |
|---|---|---|
| POST | `/laws` | **K** — establish a law from ≥3 experiments (RANSAC on the largest self-consistent region); writes domain + seeds supporting evidence |
| POST | `/laws/check` | **C→B→N** — classify a new experiment vs all laws, persist as evidence; if accumulated counter-evidence forms a *structured* breakdown, create a `breakdown_event` + one `gap_recommendation` |
| GET | `/laws/gaps` | open gap recommendations — *what to run next*, enriched with law + breakdown |
| GET | `/laws/:id/history` | full lineage: domains, evidence ledger, breakdown events, gap recommendations |
| POST | `/laws/:id/evidence` | add experiment(s) to a specific law and re-evaluate |
| POST | `/laws/:id/resolve-breakdown` | **L** — confirm a breakdown and birth a narrowed **successor law**: child gets `parent_law_id` + the new boundary domain, parent → `superseded`, breakdown → `resolved` |
| GET | `/laws` | list laws |

`GET /laws/:id/history` returns a `lineage` block (`parent` + `children`), so
the graph shows a **shoshelet / lineage of laws**, not just a list of insights.

## Why domain scopes only the input variable

A law `ttf ~ app` *implicitly over-generalises*: it claims to hold for **all**
humidity. If the domain auto-restricted humidity to where we happened to
sample, humid evidence would be filed `out_of_domain` and the law would
silently excuse itself from the very data that should contradict it — and no
knowledge would ever evolve. So the domain scopes only `x_key`; the other
features are dimensions a breakdown can be discovered along. (This was a real
bug caught in the DoD simulation, and the fix is the conceptual heart of the
design.)

## Proof — `node scripts/law-graph-demo.mjs`

In-memory simulation of the endpoint logic (no DB needed) on a Fresco-style
case where a flame-retardant additive `APP%` raises time-to-failure `TTF`
**until humidity crosses ~80%**, where protection collapses (hidden from the
engine; no data between humidity 74 and 84):

```
K — established law: ttf_days ≈ 0.87·app + 8.8 | domain app ∈ [20,40] (invariant-over: humidity) | seeded 24 evidence
C — streaming humid experiments through /laws/check:
  E25 hum=84 -> contradiction (resid -15.1)
  E26 hum=84 -> contradiction (resid -23.0)
  E27 hum=84 -> contradiction (resid -27.7) -> 🔥 BREAKDOWN humidity_pct≥79   ← fires on the 3rd, not the 1st
  …
N — GET /laws/gaps:
  🧪 {"humidity_pct":79,"app_pct":40}
     gap in humidity ∈ (74,84); law predicts ttf≈44 while breakdown region ≈11 — maximal disagreement
L — POST /laws/L1/resolve-breakdown (decisive experiment confirms the boundary):
  ↳ successor L2: ttf~app | humidity_pct < 79   (v2, parent=L1)
     parent L1 -> superseded;  breakdown -> resolved (resolved_by L2)
  lineage:  L1 (superseded, v1)  →  L2 (active, v2, humidity<79)
DoD: ✓ experiment in → checked → classified → breakdown → ONE decisive experiment → saved as law history
DoD-L: ✓ breakdown confirmed → child law w/ parent_law_id → new domain → parent superseded → breakdown resolved → lineage parent→child
```

The breakdown fires only once enough structure accumulates (3rd contradicting
experiment), never on a lone anomaly — the guard against false discovery. The
successor law `L2` narrows the relation to its still-valid region
(`humidity < 79`); the parent is retired but kept for lineage. That is the
full **K → C → B → N → L** loop: the graph now *evolves*, it doesn't just
record.

## Limits (honest)

Linear / single-output (the *architecture* generalises; the *fit* must be
swapped for real models); correlation not causation (a boundary may be a
confounder — needs control before it is trusted as a mechanism); data density
gates honesty (the answer to "too sparse" is precisely the decisive
experiment). Successor-law creation (`L`: turning a confirmed boundary into a
bounded child law via `parent_law_id`) is modelled but not yet automated — the
next build.
