---
document_type: Architecture Principles
status: Canonical
owner: MATRIYA
version: 1.0
derived_from: Loop Engineering v1
---

> **Single Source of Truth.** This file (in `matriya-back/docs/`) is the one canonical
> copy. Do not duplicate its content into other repositories or create parallel
> versions — reference it instead, to prevent drift.

# Loop Engineering — Architectural Principles

> **Status: architectural reference (not implementation).**
> These are the rules that emerged while building the v1 loop-engineering system
> (Daily Triage, PR Babysitter, CI Sweeper) for MATRIYA. They describe *how a loop
> must be shaped*, not how any particular loop is coded.
>
> **Purpose:** every future expansion of the Loop mechanism — including Observation
> Layer v2 (knowledge, documents, experiments, equipment, projects) — must be
> evaluated against these principles before it is built. If a proposed loop violates
> one of them, the design is wrong, not the principle.
>
> This document does not describe files, commands, or tooling. For the concrete
> implementation see `loops/` (LOOP.md, STATE.md, loop-run-log.md, loop-budget.md,
> MONITORING-POLICY.md).

---

## How to read each principle

Each principle is stated as a rule, then explained across five fixed fields:

- **Principle** — the rule, in one sentence.
- **Rationale** — why it exists; what property it protects.
- **Scope** — where it applies and where it does not.
- **Failure Mode** — what goes wrong when it is ignored.
- **Examples** — concrete situations from v1 that demonstrate it.

---

## 1. Observation Before Action

- **Principle.** A loop must establish ground truth by observation before it is
  permitted to change anything; observation is the default mode and action is the
  exception that must be justified.
- **Rationale.** Acting on assumed or stale state lets a single wrong belief compound
  at machine speed. Observation is cheap and reversible; action is neither. A loop that
  reads first can be wrong harmlessly; a loop that writes first cannot.
- **Scope.** The first phase of every loop, and the rollout of every new loop, which
  begins read-only and is promoted to action only after it has earned trust. Does not
  forbid action — it forbids *unobserved* action.
- **Failure Mode.** A loop "fixes" a problem inferred from a stale signal, amplifying
  damage faster than a human can intervene; or it churns on a condition that never
  actually held.
- **Examples.**
  - Daily Triage runs report-only: it observes build/test/audit/PR state and writes
    findings, but changes no code.
  - The CI Sweeper pulls the failing job logs and reproduces the failure locally
    *before* forming a fix — it never patches blind.

## 2. Persistent State

- **Principle.** A loop's memory must live in a durable spine outside any single run or
  conversation, so that each run continues from accumulated knowledge rather than from
  zero.
- **Rationale.** Conversation context is ephemeral; a loop without external memory
  repeats itself instead of making progress, re-raises resolved issues, and re-pays
  costs it already paid. State is the difference between iteration and looping in place.
- **Scope.** Every loop reads state at the start of a run and writes it at the end:
  open items, suppressions, known-good baselines, and an append-only audit trail. Does
  not mean "store everything" — it means store what the *next* run needs to make
  progress.
- **Failure Mode.** Each run rediscovers the same findings, forgets which were already
  dismissed, loses the last-known-good baseline, and produces noise indistinguishable
  from signal — the loop appears busy but the system does not improve.
- **Examples.**
  - Durable open items + suppressions prevent a finding already triaged from being
    raised again every day.
  - Recording the last green commit lets a later run reason about regressions instead
    of re-deriving health from scratch.

## 3. Evidence-Level Separation

- **Principle.** Confidence is a distinct axis from severity; every finding carries an
  explicit evidence level (VERIFIED / PARTIAL / UNVERIFIED) alongside its impact, and
  the two are never collapsed into one number.
- **Rationale.** Severity says how bad something *would* be if real; evidence says how
  sure we are that it is. Treating all findings with equal certainty manufactures false
  urgency and provokes action that was never warranted. This mirrors MATRIYA's existing
  Evidence / FSCTM discipline of separating verified, partial, and unverified
  information.
- **Scope.** Every recorded finding, in every loop. For security findings, an
  additional relevance classification (runtime / dev-only / transitive /
  known-non-exploitable) is part of the same discipline.
- **Failure Mode.** An UNVERIFIED "critical" is treated as a confirmed emergency; a
  scanner's raw count is read as a list of real exploits; the loop spends its authority
  and budget on findings that, once investigated, were never relevant.
- **Examples.**
  - `npm audit` vulnerability *counts* are VERIFIED, but their *exploitability in our
    usage* is UNVERIFIED — so they become an investigation task, not a fix task.
  - A high-severity CVE in a dev-only transitive dependency is recorded with PARTIAL
    relevance, not actioned automatically.

## 4. Action Authority Principle

- **Principle.** A loop's authority to act is graduated and explicitly declared
  (report → assisted → unattended), and a loop must never act above the authority it
  has been granted, nor above the evidence level of the finding it is acting on.
- **Rationale.** Autonomy is earned, not assumed; blast radius scales directly with
  authority. Making the level explicit turns "how much is this loop allowed to do" from
  an implicit accident into a deliberate, auditable decision.
- **Scope.** Every loop declares its level; promotion to a higher level is a separate,
  deliberate act after the lower level has proven safe. Caps the *maximum* action; it
  never compels action.
- **Failure Mode.** A loop silently operates beyond its mandate — merging, refactoring,
  or rewriting where it was only meant to report — and trust in the entire mechanism
  collapses after a single overreach.
- **Examples.**
  - The CI Sweeper is assisted-level: it pushes a fix to the working branch but never
    merges.
  - The PR monitoring posture caps automatic response to clearly infrastructural
    issues; everything else is observe-and-record.

## 5. Human Authority Boundary

- **Principle.** Certain decisions are reserved for humans, and a loop must not cross
  that boundary regardless of how confident it is.
- **Rationale.** Judgment, design intent, scope, and irreversible or outward-facing
  actions belong to the people who own the system. A confident agent is still not the
  owner; high confidence is not a transfer of authority.
- **Scope.** Reserved decisions include merging, changing application behavior, design
  and architectural choices, expanding scope, and speaking on a human's behalf.
  Distinct from Principle 4: that one bounds *how much* a loop may do; this one marks
  decisions a loop may *never* do autonomously, at any level short of explicit grant.
- **Failure Mode.** A loop answers a design review in the user's name, merges a PR, or
  quietly widens scope — usurping ownership and producing changes no human chose.
- **Examples.**
  - The monitoring policy forbids merge, application-code changes, refactors, scope
    expansion, and replying to design comments on the user's behalf.
  - A non-infrastructural review request is documented and left for human approval
    rather than answered automatically.

## 6. Cost Budget

- **Principle.** Every loop operates under explicit, enforced cost ceilings; when a run
  would exceed its ceiling, the loop stops and reports — the work yields, the budget
  does not.
- **Rationale.** Loops consume resources at machine speed and cadence multiplies spend;
  costs vary wildly between a token-rich and a token-poor operator, so loops are
  designed for the poor case. An unbounded loop is a financial and operational hazard
  regardless of how useful it is.
- **Scope.** Per-run and per-day ceilings for every loop, plus the choice of cadence
  and trigger. Applies to compute/token cost specifically; it is orthogonal to whether
  the loop's *output* is valuable.
- **Failure Mode.** A loop on a tight polling cadence quietly spends enormous daily
  cost for marginal benefit; or a runaway loop iterates without bound because nothing
  was empowered to halt it on cost grounds.
- **Examples.**
  - Declared per-run / per-day caps that convert "over budget" into "stop and report a
    partial result."
  - Preferring event-driven triggers and an hourly self-check over minute-by-minute
    polling, because cadence is the dominant cost lever.

## 7. Measurable Stop Conditions

- **Principle.** A loop must have an objective, checkable definition of both "done" and
  "give up," decided before it runs.
- **Rationale.** A recursive goal without a measurable terminal state either runs
  forever or stops arbitrarily. "Done" must be something a machine can test, not a
  feeling — otherwise the loop cannot know when to stop and neither can its operator.
- **Scope.** Every loop defines a success condition and an abort condition (a bounded
  number of attempts, a convergence rule, or an explicit hand-off). Applies to the
  loop's control flow, independent of what it is observing.
- **Failure Mode.** The loop retries the same ineffective action indefinitely, or
  "completes" on a vague self-assessment that was never verifiable, hiding incomplete
  work behind a clean-looking result.
- **Examples.**
  - The CI Sweeper terminates on green CI *or* a hard cap of attempts, then hands off
    to a human with a diagnosis.
  - Discovery-style loops converge on "no new findings for N consecutive rounds" rather
    than an open-ended search.

## 8. Infrastructure Before Automation

- **Principle.** Automation presupposes the substrate it depends on; the infrastructure
  and its signals must exist and be verified before a loop is layered on top of them.
- **Rationale.** A loop that watches a signal which does not exist, or stands on a
  broken foundation, is meaningless at best and harmful at worst — because automation
  amplifies whatever foundation it stands on, including its defects.
- **Scope.** The ordering of work: establish and validate the dependency (the pipeline,
  the lockfile, the configured trigger) before enabling the loop that consumes it.
  Applies to bring-up and to any expansion that introduces a new dependency.
- **Failure Mode.** A CI-fixing loop is scheduled where no CI pipeline exists; an
  install-automation runs against an out-of-sync lockfile; a scheduled loop fails
  noisily because the credential it needs was never configured.
- **Examples.**
  - A CI pipeline was created first, so the CI Sweeper had a real signal to watch.
  - A pre-existing lockfile drift was repaired so that clean-install automation could
    even run.
  - Scheduled automation is opt-in and no-ops cleanly until its prerequisites are
    configured, rather than failing loudly.

---

## Using these principles for expansion

Before any new loop or layer (including Observation Layer v2) is built, check it
against all eight:

1. Does it **observe before acting**, and start read-only?
2. Does it carry **persistent state** the next run can build on?
3. Does it record findings with a **separated evidence level**?
4. Is its **action authority** explicit and bounded?
5. Does it respect the **human authority boundary** for reserved decisions?
6. Does it run under an enforced **cost budget**?
7. Does it have **measurable stop conditions** for done and give-up?
8. Does the **infrastructure it depends on** already exist and pass verification?

A design that cannot answer "yes" to each is not ready to build.
