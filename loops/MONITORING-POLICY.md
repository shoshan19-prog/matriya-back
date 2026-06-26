# MONITORING-POLICY.md — Passive & conservative PR watch

> Active for PR #1 (`claude/unknown-session-6zmis6`). This is the binding policy for the
> PR Babysitter loop while watching. It **overrides** the default L2 behaviour with a
> stricter, mostly-passive posture. When in doubt, do nothing and wait for a human.

## Watch (observe & log everything)

- Reviews
- Review comments
- CI failures
- Merge conflicts
- "Changes requested"

## May auto-respond ONLY when the issue is clearly infrastructural

- ❌→✅ CI failed
- ❌→✅ Merge conflict
- ❌→✅ Lockfile drift (e.g. `npm ci` out-of-sync)
- ❌→✅ A clear infrastructure problem (workflow/config/build plumbing)

A permitted auto-response means: a minimal fix to the **infrastructure**, pushed to the
PR branch, then logged. Nothing more.

## Never (no exceptions without explicit human approval)

- ⛔ Merge the PR
- ⛔ Change application code
- ⛔ Answer design / architectural review comments on the user's behalf
- ⛔ Refactor
- ⛔ Expand scope

## Every action is logged

Append a row to `loop-run-log.md` for **every** event handled — including "observed,
no action". The log is the record; do not act silently.

## Non-infrastructural review requests

If a review request is **not** infrastructural: **document it only** (a row in
`loop-run-log.md` + an Open item in `STATE.md`) and **wait for human approval**. Do not
reply in the user's name and do not change anything.

## Exit

Watch continues until the PR is **MERGED or CLOSED**, or the user says stop.
