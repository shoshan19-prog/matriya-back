---
name: repository-health
description: OBSERVE-ONLY repository-health monitor. Measures the health of THIS repository across Build, Tests, Type Safety, Coverage, Security, Reliability, Dead Code, Dependency Health and Documentation, computes an overall health score, and produces a Health Report with a single recommendation. It NEVER modifies code and NEVER opens a PR.
---

# Repository Health — Observe & Diagnose

A diagnostic monitor, not a fixer — the *doctor*. It observes, runs tests,
diagnoses, and reports. The decision to act belongs to a human (or to the
`safe-repair` skill, under strict conditions).

```
Repository → Observe → Test → Diagnose → Report
                                            ↓
                                     (Human / threshold)
                                            ↓
                                       safe-repair
```

**This skill never changes a line of code and never opens a PR.**

## Scope

Operate on **the current checked-out repository only**.

## Health dimensions

Assign each dimension 🟢 healthy / 🟡 attention / 🔴 problem, backed by evidence
(command + output). Mark a dimension `N/A` if the repo has no tooling for it.

| Dimension | How to measure |
|-----------|----------------|
| **Build** | `npm run build` / compile / `go build` — builds clean? |
| **Tests** | `npm test` / `pytest` / `go test ./...` — pass/fail counts. |
| **Type Safety** | `tsc --noEmit` / `mypy` — error count. |
| **Coverage** | Coverage report if configured — % and trend. |
| **Security** | `npm audit` / `pip-audit` / secret scan — severity & count. |
| **Reliability** | Unhandled rejections, missing error handling, unawaited async, missing timeouts. |
| **Dead Code** | Unused imports/vars/exports, unreachable code. |
| **Dependency Health** | Outdated/deprecated deps, lockfile drift. |
| **Documentation** | README/docs drift vs. code (missing/renamed scripts, stale setup). |

## Overall health score

0–100%, equal weight across assessed dimensions (🟢=100, 🟡=60, 🔴=0).
A 🔴 on **Build** or **Tests** caps the overall score at **79%**.

## The Health Report (the only output)

```
══════════════════════════════
Repository Health — <repo>
<date>

🟢 Build
🟢 Tests
🟡 Coverage
🟢 Security
🔴 Dead code
🟡 Documentation

Overall Health
<NN>%

Today's recommendation
<single highest-value action, e.g. "Fix: dead code">

Estimated risk
LOW | MEDIUM | HIGH
══════════════════════════════
```

Add one short evidence line under each 🟡/🔴.

## Action policy (verdict only — this skill never acts)

| Overall Health | Verdict |
|----------------|---------|
| **≥ 95%** | No action. Healthy. No PR. |
| **80–95%** | Collect observations only. No PR. |
| **< 80%** | Repair eligible — hand to `safe-repair` (still gated there). |

This threshold prevents PR noise: a 96% repo with one stray warning → no PR.

## Guardrails

- Read-only. No commit, no branch, no push, no PR. Ever.
- Time-box hanging checks; mark `🟡 (could not measure)` and continue.
- Report honestly — a red dimension is information, not something to hide.
