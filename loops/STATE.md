# STATE.md — Durable loop memory

> The spine that lives **outside** any single conversation. Loops read this at the
> start of a run and write it at the end. It is the difference between an agent that
> repeats itself and one that makes progress.

_Last updated: (not yet run)_

---

## Open items (carried between runs)

> Append `- [ ] <item> — discovered <date> by <loop>`; check off when resolved.

- _none yet_

---

## Known-good baseline

- **Test command:** `npm test` (runs unit/check scripts)
- **Integration:** `npm run test:integration`
- **Last green commit:** _(record the SHA the first time the loop sees CI/tests pass)_
- **Node:** >= 18

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
