# Repository Health & Safe Repair

Two-layer, MATRIYA-style code-health automation. Observation is separated from
action; an automated change only ever reaches `main` through a human-reviewed PR.

```
Repository → Observe → Test → Diagnose → Fix (safe only) → Verify
   → Pull Request → Human Review → Merge
```

## The two layers

| Skill / Workflow | Role | Touches code? | Schedule |
|------------------|------|---------------|----------|
| **repository-health** | The *doctor* — observe & diagnose, emit a Health Report | ❌ Never | Daily (`.github/workflows/repository-health.yml`) |
| **safe-repair** | The *treatment* — open ONE low-risk PR, then stop | ✅ via PR only | Manual only (`.github/workflows/safe-repair.yml`, `workflow_dispatch`) |

The daily job **only observes**. Repair is never automatic on a schedule — it is
triggered manually, and even then only opens a PR (never merges).

### Noise threshold

| Overall Health | What happens |
|----------------|--------------|
| ≥ 95% | Nothing. Healthy. |
| 80–95% | Observations collected. No PR. |
| < 80% | Repair-eligible (tracking issue opened; repair still gated). |

## Setup — required secret

Both workflows call the Claude Code GitHub action, which needs an API key.

1. Get a key from the Anthropic Console (https://console.anthropic.com/).
2. In this repo: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `ANTHROPIC_API_KEY` — Value: your key.

Without this secret the workflows will fail at the Claude step.

## Running

- **Health (daily):** runs automatically; or **Actions → Repository Health → Run workflow**.
- **Repair (manual):** **Actions → Safe Repair → Run workflow**, optionally
  passing a specific `finding` to fix.

The matching skill definitions live in `.claude/skills/` so they are versioned
with the code and used both by the workflows and by local Claude Code sessions.
