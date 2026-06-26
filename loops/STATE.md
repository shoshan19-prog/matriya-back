# STATE.md — Durable loop memory

> The spine that lives **outside** any single conversation. Loops read this at the
> start of a run and write it at the end. It is the difference between an agent that
> repeats itself and one that makes progress.

_Last updated: 2026-06-26 (daily-triage run #1)_

---

## Open items (carried between runs)

> Append `- [ ] <item> — discovered <date> by <loop>`; check off when resolved.

- [ ] 🔴 `npm audit`: 26 vulnerabilities (1 critical, 17 high, 8 moderate) — discovered 2026-06-26 by daily-triage
- [ ] 🟡 Major-version dep drift with security relevance: multer 1.4.5→2.2.0, pdf-parse 1.1.4→2.4.5, express 4→5, bcrypt 5→6, dotenv 16→17 — discovered 2026-06-26 by daily-triage
- [ ] 🟢 CI workflow added this session — confirm it goes green on first run — discovered 2026-06-26 by daily-triage

---

## Known-good baseline

- **Test command:** `npm test` (runs unit/check scripts)
- **Integration:** `npm run test:integration`
- **Last green commit:** _(not yet confirmed — CI just added)_
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

- _none yet_
