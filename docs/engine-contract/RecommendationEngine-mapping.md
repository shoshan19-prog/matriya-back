# Recommendation Engine (Engine 3) — Contract v1.0 Fit + Gap Analysis

Fourth engine on paper, and the first one **demanded by the Capability Planner**
rather than proposed. The Scientific Task Contract for "reduce water absorption"
(`diagnosis`) required `recommend ≥ 3`; no existing engine provided it (best was
2). This engine closes that gap — and stress-tests the frozen Engine Contract
v1.0 with a `recommend`-heavy profile.

**Docs only. No runtime code, no Composer, no endpoints.**
Instance: [`RecommendationEngine.contract.json`](./RecommendationEngine.contract.json)
(validated against `engine-contract.schema.json`).

## The discipline: Recommendation ≠ Decision

The system may **rank, explain, and suggest** — it must **never decide** for the
human. This is enforced structurally, not by convention:

- Every recommendation's `decisionStatus` is `const: "decision_support"`.
- `outputEpistemics.outputClass = "hypothesis"` → the schema forces
  `validationGating: human_gated` + `emitsUnvalidated: true`. The system cannot
  present a ranking as settled.
- `E_TIE_UNRESOLVED`: when the top options tie within the confidence interval,
  the engine **returns the tie flagged** — it does not break it arbitrarily. The
  machine does not resolve what only a human should.

## 1. Mapping: Evidence + Constraints + Context + Options → Ranked Recommendations

```
ikl.OptionSet@1        (>=2 candidates — a recommendation needs alternatives) ┐
ikl.DecisionCriteria@1 (weighted goals + hard constraints)                    ┼─ rank_options_evidence_weighted ─► ikl.RecommendationSet@1
ikl.DecisionContext@1  (optional project/geo)                                 │
KB evidence            (dependency: performance, failures, provenance) ───────┘
```

"Evidence" is read from the IKL (performance / failure / provenance) per option
— a **dependency**, not a per-call input — while the criteria/context/options are
the typed `consumes`. Each produced recommendation carries: rank, rationale,
confidence, `tradeOffs`, `whyNotAlternatives`, `missingEvidence`, `assumptions`,
`provenance`, and `constraintFit`. The set also lists `alternativesConsidered`
(every option scored) so **why-not is always visible, not just the winner**.

## 2. Capability Vector

```
observe ★★★☆☆  explain ★★★★☆  predict ★★☆☆☆  recommend ★★★★★
generate ★☆☆☆☆  validate ★★★☆☆  learn ★☆☆☆☆
```

`recommend 5` (closes the gap), `explain 4` (a recommendation must justify
itself), `validate 3`, `observe 3`. Exactly the recommend/explain-heavy profile
the task required.

## 3. Reasoning Signature

```json
"reasoning": { "class": "optimization", "confidenceType": "independent_evidence",
  "emitsTrace": true, "evidenceModel": "evidence-weighted per goal, constraint-aware" }
```

`optimization` and `independent_evidence` are the closest **frozen** enum values;
both are honest fits (recommendation *is* constrained multi-criteria ranking), and
both are flagged as vocabulary gaps (RG1, RG2) — not distortions.

## 4. Output epistemics — decision-support, not decisions

`outputClass: hypothesis`, `emitsUnvalidated: true`, `validationGating:
human_gated`, `neverAssertsAs: [fact, knowledge, validated_knowledge]`. Safety
fields the manifest enum can't name (trade-offs, why-not, decision-status) are
required in the **produces** schema instead — the same pattern the generative
engine used.

## 5. Safety rules (all enforced structurally)

| Rule | Enforcement |
|------|-------------|
| Never auto-decide | `decisionStatus` const `decision_support`; `outputClass hypothesis` ⇒ human-gated; `E_TIE_UNRESOLVED` refuses to break ties |
| Never hide uncertainty | `confidence` required per item; `E_INSUFFICIENT_EVIDENCE` yields low confidence + `missingEvidence`, never a confident guess |
| Always show why-not | `whyNotAlternatives` (minItems 1) per recommendation + `alternativesConsidered` (all scored) |
| No orphan advice | `provenance` (minItems 1) required per recommendation |
| Won't invent goals | `E_NO_CRITERIA` — refuses to rank without objectives |

## 6. Gap list — against Engine Contract v1.0 (vNext candidates)

The engine **fits frozen v1.0 and preserves all safety** (validates; safety
enforced via payload + human-gating). It is therefore **not** a contract failure
under the governing rule. But it surfaces that the safety *vocabulary* has a blind
spot exactly at the human/machine boundary:

- **RG1 — `reasoning.class` lacks `recommendation`/`deliberative`.** Used
  `optimization` as a proxy. Minor.
- **RG2 — `confidenceType` lacks `evidence_weighted`/`multi_criteria`.** Used
  `independent_evidence`. Minor.
- **RG3 (important) — the safety envelope cannot say "decision-support, never a
  decision" at the manifest level.**
  - `outputEpistemics.outputClass` has no `decision_support` value → used
    `hypothesis` (which usefully forces human-gating, but is imprecise).
  - `outputEpistemics.neverAssertsAs` has no **`decision`** token — the single most
    important assertion (Recommendation ≠ Decision) is enforced only in the
    payload (`decisionStatus`), not declarable in the manifest.
  - `outputEpistemics.guarantees` lacks `trade_offs` and `why_not_alternatives`
    — required in the payload instead.

RG3 is the first *safety-relevant* refinement found since the freeze.

> **RG3 — RESOLVED in Engine Contract v1.1 (Decision Boundary), and more deeply
> than proposed.** The fix is *not* `outputClass = decision_support`. The deeper
> truth is that **a Decision is never an engine output at all** — it is a human
> act over many emissions. v1.1 adds `outputEpistemics.emits`, a closed vocabulary
> (`observation … recommendation … trade_off … risk … missing_evidence`) that
> **omits `decision`**, so no engine can declare it emits one. Decisions live on
> the separate **Decision Workspace**
> ([`../task-contract/DecisionWorkspace.md`](../task-contract/DecisionWorkspace.md)),
> outside the Engine Platform. This Recommendation Engine now declares
> `emits: [recommendation, trade_off, risk, confidence, missing_evidence,
> explanation]` — a ranking, never a decision.

## 7. Verdict — the success question

**Can frozen Engine Contract v1.0 represent a recommend-heavy engine without
changing the standard? — Yes.** The Recommendation Engine validates against v1.0
unchanged, with two proxied reasoning tokens (RG1, RG2) and its decision-support
safety enforced in the produces schema. Re-running the Capability Planner with
this engine added, the "reduce water absorption" task goes from **1 gap → fully
satisfiable**.

Four engines now span the space — retrieval / evidential / generative /
**recommendation** — on one frozen contract:

| Engine | reasoning | recommend | outputClass | decides? |
|--------|-----------|:---------:|-------------|:--------:|
| ikl-search | retrieval | 0 | asserted | no |
| knowledge-event | evidential | 0 | hypothesis | no |
| combination-discovery | generative | 2 | hypothesis | no |
| **recommendation** | optimization* | **5** | hypothesis | **no — decision-support only** |

Nothing implemented. The honest next question for you: does **RG3** justify the
first post-freeze contract revision (add a `decision` boundary to the safety
envelope), or do we keep it payload-enforced and proceed to the Capability
Planner / G7?
