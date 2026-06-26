# STATE.md — Durable loop memory

> The spine that lives **outside** any single conversation. Loops read this at the
> start of a run and write it at the end. It is the difference between an agent that
> repeats itself and one that makes progress.

_Last updated: 2026-06-26 (daily-triage run #1)_

---

## Open items (carried between runs)

> Append `- [ ] <item> — discovered <date> by <loop>`; check off when resolved.

- [ ] 🔴 `[VERIFIED count / UNVERIFIED exploitability]` `npm audit`: 26 vulnerabilities (1 critical, 17 high, 8 moderate) — counts confirmed via `npm audit --json`; exploitability in our usage NOT assessed. **Action: classify each runtime/dev/transitive/non-exploitable before any fix.** discovered 2026-06-26 by daily-triage
- [ ] 🟡 `[VERIFIED drift / UNVERIFIED impact]` Major-version dep drift: multer 1.4.5→2.2.0, pdf-parse 1.1.4→2.4.5, express 4→5, bcrypt 5→6, dotenv 16→17 — newer versions confirmed via `npm outdated`; breaking-change impact not evaluated. discovered 2026-06-26 by daily-triage
- [x] 🟢 `[VERIFIED]` CI workflow added this session — confirmed GREEN on 18.x + 20.x (PR #1 checks) — 2026-06-26

---

## Known-good baseline

- **Test command:** `npm test` (runs unit/check scripts)
- **Integration:** `npm run test:integration`
- **Last green commit:** `b6cb0d9` (CI green on Node 18 + 20, 2026-06-26)
- **Node:** >= 18

> ⚠️ Local sandbox note: `npm ci` cannot complete here because `sharp` (transitive via
> `@xenova/transformers`) needs a native binary download that the sandbox blocks. The
> resulting test failures are an ENVIRONMENT artifact, not a repo defect. Trust GitHub
> Actions CI (ubuntu-latest) for the real test signal, not local runs in this sandbox.

---

## Decisions & conventions the loops must respect

- Develop on branch `claude/<session>`; never push straight to `main`.
- ESM project (`"type": "module"`) — use `import`, not `require`.
- Do not commit secrets; `.env` stays local (see `env_example.txt`).
- Do not "fix" tests by weakening assertions — fix the cause.

---

## Suppressions / known false positives

> Things a loop already investigated and decided to leave alone, with a reason.
> Prevents the same finding from being re-raised every run.

- _none yet_

---

## Hand-off notes

> Free-form context the next run needs but that doesn't fit above.

- **PR #1 watch ACTIVE** under `loops/MONITORING-POLICY.md` — passive/conservative. Auto-fix only for infra (CI fail / merge conflict / lockfile drift / clear infra). Never merge, change app code, refactor, expand scope, or answer design comments on the user's behalf. Non-infra review requests → document + wait for human. Log every event.
- **Observation Layer v2 — PLANNED, BLOCKED.** Do NOT start until PR #1 is merged AND the system runs several days with no abnormal intervention. Goal: evolve the Loop mechanism from code-only monitoring into a general MATRIYA observation layer covering knowledge, documents, experiments, equipment, and projects (same control plane: STATE/run-log/budget/evidence_level).
