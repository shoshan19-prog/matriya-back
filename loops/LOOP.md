# LOOP.md — Loop Engineering for matriya-back

> **Loop engineering is replacing yourself as the person who prompts the agent.
> You design the system that does it instead.** — Addy Osmani, _Loop Engineering_ (June 2026)

A *loop* is a recursive goal: you define a purpose and an AI agent iterates until
the goal is met. Instead of hand-prompting an agent over and over, you design the
system — cadence, state, guardrails — that prompts it for you.

This directory is the control plane for the loops that maintain this repository.

---

## The 5 building blocks (+ memory)

| Block | What it is here |
|-------|-----------------|
| **Automations / Scheduling** | GitHub Actions `schedule:` triggers + Claude Code `/loop` commands |
| **Worktrees** | Isolated git worktrees so parallel loops never clobber each other |
| **Skills** | Project knowledge in `.claude/commands/` — reusable loop definitions |
| **Plugins & Connectors** | GitHub MCP for PR/CI/issue access |
| **Sub-agents** | Maker/checker splits — one agent fixes, another verifies |
| **State / Memory** | `STATE.md` is the durable spine that survives between runs |

---

## Active loops

| Pattern | File | Cadence | Autonomy | Cost |
|---------|------|---------|----------|------|
| Daily Triage | [patterns/daily-triage.md](patterns/daily-triage.md) | 1–2h / daily | L1 (report only) | Low |
| PR Babysitter | [patterns/pr-babysitter.md](patterns/pr-babysitter.md) | 5–15 min | L2 (assisted) | High |
| CI Sweeper | [patterns/ci-sweeper.md](patterns/ci-sweeper.md) | on CI failure | L2 (cautious) | Very high |

---

## Autonomy levels (phased rollout)

Always start a new loop at **L1** and only promote it after it earns trust.

- **L1 — Report.** The loop observes and writes findings (to `STATE.md` / an issue / a comment). It changes nothing. Zero blast radius.
- **L2 — Assisted.** The loop proposes a concrete change (a branch, a draft PR, a patch) for a human to approve. No auto-merge.
- **L3 — Unattended.** The loop acts and merges on its own, inside a tight denylist. Reserve for narrow, reversible, well-tested tasks.

---

## Non-negotiable guardrails

1. **Cost ceiling.** Every loop declares a token/run budget in [loop-budget.md](loop-budget.md). When a run would exceed it, the loop stops and reports instead of continuing.
2. **Measurable stop condition.** A loop must know what "done" means — `npm test` green, no new findings for 2 rounds, CI passing. No vague goals.
3. **Human in the loop.** Nothing merges to `main` without review unless explicitly promoted to L3.
4. **Append-only audit trail.** Every run appends to [loop-run-log.md](loop-run-log.md). Silent truncation or skipped coverage must be logged.

---

## Evidence level (every finding carries one)

MATRIYA already separates verified / partial / unverified information (Evidence / FSCTM).
Loops follow the same discipline: **severity says how bad it _would_ be; evidence level
says how sure we are.** Tag every finding with both — never collapse them into one number.

```
finding:
  severity:        critical | high | moderate | low   # impact if real
  evidence_level:  VERIFIED | PARTIAL | UNVERIFIED      # how sure we are
```

- **VERIFIED** — confirmed by direct command output this run (CI log, `npm audit --json`, a reproduced failure).
- **PARTIAL** — indirect or incomplete evidence (a tool flags it, but impact/exploitability wasn't checked, or only a subset was scanned).
- **UNVERIFIED** — inferred or assumed; not reproduced (a hypothesis from a log line, a finding carried in from elsewhere).

**Rule:** never raise a finding's *action priority* above its evidence level. An
UNVERIFIED "critical" is an **investigation** task, not a fix task.

For **security findings**, also classify the dependency before deciding action:
**runtime · dev-only · transitive · known-non-exploitable**. A high-severity CVE in a
dev-only transitive dep is usually PARTIAL relevance at most — don't `audit fix --force` it.

---

## How to run a loop

**Locally with Claude Code:**
```
/loop-daily-triage      # one-shot triage report
/loop-ci-sweeper        # diagnose + fix a failing CI run
/loop-pr-babysitter     # watch an open PR and respond
```

**Scheduled:** see [.github/workflows](../.github/workflows) for the cron-driven variants.

---

_Inspired by Addy Osmani (https://addyosmani.com/blog/loop-engineering/) and
Boris Cherny: "I don't prompt Claude anymore. My job is to write loops."_
