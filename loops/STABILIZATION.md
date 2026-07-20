# STABILIZATION.md — Loop Engineering v1

> **Status: STABILIZATION (freeze) — entered 2026-06-26.**
> The architecture is complete enough. The next investment is *usage and evidence*,
> not more infrastructure. We treat the platform like any R&D subject:
> experiment → data → model → decision.
>
> **Hypothesis under test:** _Loop Engineering improves how the system is managed._
> Stabilization exists to turn that hypothesis into an evidence-backed claim.

Architecture reference (canonical, do not duplicate):
`matriya-back/docs/LOOP_ENGINEERING_PRINCIPLES.md`.

---

## Freeze — not allowed during stabilization

- ⛔ No new features.
- ⛔ No new adapters.
- ⛔ No starting Observation Layer v2.
- ⛔ No expansion to additional repositories.
- ⛔ No architecture changes — **unless a material defect is discovered.**

## Allowed during stabilization

- ✅ Passive/conservative PR watch per `MONITORING-POLICY.md` (infra-only auto-fixes).
- ✅ Tracking the two open PRs through to merge.
- ✅ Data collection only (see `metrics.md`).
- ✅ Bug-fixes for material defects in the existing mechanism.

---

## What we do

1. **Watch** both PRs (matriya-back#1, matriya-front-#1) until merged.
2. **Verify** the system stays stable for several days post-merge with no abnormal
   intervention.
3. **Collect data only** into `metrics.md` — no behavioural changes driven by it yet.

## Metrics collected (defined in `metrics.md`)

- Number of loop runs
- Number of events
- Number of automatic interventions
- Number of human interventions
- False positives
- False negatives
- Mean time to detect (MTTD)
- Mean time to resolve (MTTR)

---

## Exit criteria

Stabilization ends only when **all** hold:

1. Both PRs are merged.
2. The system has run several days with no abnormal intervention.
3. Enough data exists in `metrics.md` to evaluate the hypothesis.

On exit, produce **`Loop Engineering v1 Validation Report`** (see outline below). No
decision about Observation Layer v2 is made before that report.

## Validation Report outline (produced at exit)

1. **What worked.**
2. **What did not work.**
3. **Which principles were proven in practice** (map to the 8 canonical principles).
4. **Which principles need correction.**
5. **Recommendation:** start Observation Layer v2 — yes / no / not yet — with evidence.

Target evidence to look for, e.g.: 0 undetected CI failures · reduced time-to-handle ·
0 unreviewed/uncontrolled changes · stable process throughout.
