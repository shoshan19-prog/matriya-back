/**
 * `matriya reality probe` — a map of the dark areas.
 *
 * Where does the system have no evidence to show you? Sessions with no |M|
 * snapshot, sessions where the gate was never exercised, sessions that have
 * gone silent without finishing or being flagged, and stages no session has
 * ever reached. It marks absence. It does not claim something *should* be there.
 */
import { open, close, sessions, violations, snapshots, decisions, STAGES_ORDER } from '../lib/source.js';
import { heading, table, render, shortId, ageFrom } from '../lib/frame.js';
import { stageOf, STALE_DAYS, daysAgo } from '../lib/lens.js';

const LIST_CAP = 25;

function sessionTable(arr) {
  if (!arr.length) return '';
  const rows = arr.slice(0, LIST_CAP).map((x) => [shortId(x.session), ageFrom(x.last_activity)]);
  const t = table(['session', 'last activity'], rows);
  return arr.length > LIST_CAP ? `${t}\n  …and ${arr.length - LIST_CAP} more` : t;
}

export async function realityProbe({ json = false } = {}) {
  await open();
  let payload;
  try {
    const [allSessions, allViol, allSnaps, allDecisions] = await Promise.all([
      sessions(),
      violations({}),
      snapshots(),
      decisions({})
    ]);
    const openViolSessions = new Set(allViol.filter((v) => !v.resolved_at).map((v) => v.session_id));
    const withSnaps = new Set(allSnaps.map((s) => s.session_id));
    const withDecisions = new Set(allDecisions.map((d) => d.session_id));
    const staleCutoff = daysAgo(STALE_DAYS);

    const noEvidence = allSessions.filter((s) => !withSnaps.has(s.id));
    const gateNeverExercised = allSessions.filter((s) => !withDecisions.has(s.id));
    const silent = allSessions.filter((s) => {
      const st = stageOf(s, STAGES_ORDER);
      return !st.validated && !openViolSessions.has(s.id) && new Date(s.updated_at) < staleCutoff;
    });
    const reached = new Set();
    for (const s of allSessions) {
      for (const st of Array.isArray(s.completed_stages) ? s.completed_stages : []) reached.add(st);
    }
    const stagesNeverReached = STAGES_ORDER.filter((st) => !reached.has(st));
    const stagesReached = STAGES_ORDER.filter((st) => reached.has(st));

    const toEntry = (s) => ({ session: s.id, last_activity: s.updated_at });
    payload = {
      universe: {
        sessions: allSessions.length,
        violations: allViol.length,
        integrity_snapshots: allSnaps.length,
        gate_decisions_logged: allDecisions.length
      },
      dark: {
        sessions_without_integrity_evidence: noEvidence.map(toEntry),
        sessions_gate_never_exercised: gateNeverExercised.map(toEntry),
        silent_sessions: silent.map(toEntry),
        stages_never_reached: stagesNeverReached
      },
      lit: {
        sessions_with_integrity_evidence: withSnaps.size,
        sessions_with_gate_decisions: withDecisions.size,
        stages_reached: stagesReached
      }
    };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const blocks = [
    heading('MATRIYA-LITE — reality probe'),
    'A map of the dark areas — places where the system has no evidence to show you.\nIt marks absence. It does not claim something should be there.'
  ];
  const u = payload.universe;
  if (u.sessions === 0) {
    blocks.push('The universe is empty — no sessions, no snapshots, no decisions. All dark, because nothing has happened yet.');
    return render(blocks);
  }
  blocks.push(
    `Universe: ${u.sessions} session(s) · ${u.violations} violation(s) · ${u.integrity_snapshots} integrity snapshot(s) · ${u.gate_decisions_logged} gate decision(s) logged.`
  );

  const d = payload.dark;
  const dark = [];
  if (d.sessions_without_integrity_evidence.length) {
    dark.push(
      heading(`Dark · no integrity evidence — |M| was never snapshotted (${d.sessions_without_integrity_evidence.length})`) +
        '\n' +
        sessionTable(d.sessions_without_integrity_evidence)
    );
  }
  if (d.sessions_gate_never_exercised.length) {
    dark.push(
      heading(`Dark · the gate was never exercised — no allow/hold decision on record (${d.sessions_gate_never_exercised.length})`) +
        '\n' +
        sessionTable(d.sessions_gate_never_exercised)
    );
  }
  if (d.silent_sessions.length) {
    dark.push(
      heading(`Dark · silent — no activity ≥ ${STALE_DAYS}d, not validated, not flagged (${d.silent_sessions.length})`) +
        '\n' +
        sessionTable(d.silent_sessions)
    );
  }
  if (d.stages_never_reached.length) {
    dark.push(
      heading('Dark · stages never reached anywhere in the universe') +
        '\n  ' +
        d.stages_never_reached.join(', ') +
        `   (of ${STAGES_ORDER.join('→')})`
    );
  }
  if (!dark.length) {
    blocks.push(
      'No dark areas found by the current probes — every session has some evidence, some decision, and recent-enough motion. (The probes are coarse; this is not "all clear".)'
    );
  } else {
    blocks.push(...dark);
  }

  const l = payload.lit;
  blocks.push(
    [
      'Lit — what the system can actually see:',
      `  ${l.sessions_with_integrity_evidence} session(s) with |M| evidence · ${l.sessions_with_gate_decisions} with gate decisions`,
      `  stages reached: ${l.stages_reached.join(', ') || '—'}`
    ].join('\n')
  );
  return render(blocks);
}
