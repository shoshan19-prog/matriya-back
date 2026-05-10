# MATRIYA-LITE — `matriya` CLI (M-lite.1)

A small, **read-only** CLI over the same Supabase/Postgres the API uses (it
reuses `database.js`, so there is one source of truth and no schema drift). One
principle: **visibility without false authority** (נראות בלי סמכות מדומה). It
shows you *where to look* — what is unverified, where things are stuck, where
friction piled up, what debt is parked — and stops there. It does not say whether
something is good or bad, what it means in human terms, or what to do. Like
medical imaging: it points; you interpret. It never writes to the database.

Run: `npm run matriya -- <command>` (or `node cli/matriya.js <command>`, or
`matriya <command>` once the package `bin` is on `PATH`). Add `--json` to any
command for machine-readable output.

## Commands

| Command | Shows | Backed by |
|---|---|---|
| `matriya reality status` | Sessions still **UNVERIFIED** — the K→C→B→N→L pass not yet complete (stage `L`); which ones are held by an open violation. | `research_sessions`, `violations` |
| `matriya reality probe` | **Map of the dark areas**: sessions with no `\|M\|` snapshot, sessions where the gate was never exercised, silent sessions (no activity ≥ stale-days, not validated, not flagged), stages no session ever reached — plus the "lit" counterpart. | `research_sessions`, `integrity_cycle_snapshots`, `decision_audit_log`, `violations` |
| `matriya task list [--blocked]` | Where things are stuck: **blocked** (open violation → gate closed) and **stalled** (not validated, no activity for a while, nothing flagged). `--blocked` shows hard-blocked only. Also lists research runs halted mid-flight. | `research_sessions`, `violations`, `research_loop_runs` |
| `matriya friction by-category` | Violations grouped by the rule that fired (`reason`/`type`): how many times, how many still open, last seen. Plus the noise-event re-evaluation backlog. | `violations`, `noise_events` |
| `matriya debt list [--open\|--all]` | Open debt parked in the system: unresolved violations (with a short detail hint) and noise events deferred for re-evaluation after a future kernel version. `--open` is the default; `--all` also shows resolved. | `violations`, `noise_events` |
| `matriya review week` | The last 7 days in numbers (sessions, violations opened/resolved/open, gate decisions allow/hold, research runs, top friction) and **where the system suggests you look** — each note tied to a concrete observation. Prompts, not instructions. | all of the above |

## Boundaries (on purpose)

- **Read-only.** No command mutates anything. Acting on a finding — or having
  the system act — is a different capability and is out of scope for M-lite.1.
- **No verdicts.** Every output ends with the standing note: *indicator, not a
  verdict*. Tags like `recurring`, `ageing`, `backlog` are descriptive, not
  judgements.
- **Honest about absence.** If the DB env (`POSTGRES_URL` / `SUPABASE_DB_URL`)
  is missing or unreachable, the CLI says so and exits non-zero (`3`) rather
  than pretending. "Nothing to show" is itself an answer.

## Config

| Env var | Default | Effect |
|---|---|---|
| `POSTGRES_URL` / `POSTGRES_PRISMA_URL` / `SUPABASE_DB_URL` | — | Same DB connection the API uses (reused via `database.js`). |
| `MATRIYA_LITE_STALE_DAYS` | `7` | Age after which a not-validated, unflagged session counts as "silent"/"stalled". |

## Files

- `cli/matriya.js` — entry point: arg parsing, command dispatch, honest error exits.
- `cli/lib/source.js` — read-only data access (reuses `database.js` models).
- `cli/lib/lens.js` — shared derivations (stage of a session, stale window).
- `cli/lib/frame.js` — presentation: tables, ages, the standing "indicator, not a verdict" note.
- `cli/commands/*.js` — one file per command.
- `scripts/check-matriya-lite.js` — no-DB smoke check (`npm run check:matriya-lite`).
