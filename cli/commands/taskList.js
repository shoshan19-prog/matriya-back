/**
 * `matriya task list [--blocked]` — where things are stuck.
 *
 * Hard-blocked  = a session carrying an open (unresolved) violation; its gate
 *                 is closed and it cannot proceed until that is handled.
 * Stalled       = a session that has not been validated and has had no activity
 *                 for a while, yet nothing flagged it. Quiet, not finished.
 *
 * --blocked restricts the view to hard-blocked only.
 */
import { open, close, sessions, violations, loopRuns, STAGES_ORDER } from '../lib/source.js';
import { heading, table, render, shortId, ageFrom, bullet } from '../lib/frame.js';
import { stageOf, STALE_DAYS, daysAgo } from '../lib/lens.js';

export async function taskList({ json = false, blockedOnly = false } = {}) {
  await open();
  let payload;
  try {
    const [all, openViol, runs] = await Promise.all([
      sessions(),
      violations({ openOnly: true }),
      loopRuns()
    ]);
    const violBySession = new Map();
    for (const v of openViol) {
      const arr = violBySession.get(v.session_id) || [];
      arr.push(v);
      violBySession.set(v.session_id, arr);
    }
    const staleCutoff = daysAgo(STALE_DAYS);
    const blocked = [];
    const stalled = [];
    for (const s of all) {
      const st = stageOf(s, STAGES_ORDER);
      const vs = violBySession.get(s.id) || [];
      if (vs.length) {
        const oldest = vs[vs.length - 1]; // source returns DESC by created_at
        blocked.push({
          session: s.id,
          stage: st.current,
          why: `open violation: ${oldest.reason || oldest.type}`,
          since: oldest.created_at,
          violation: oldest.id,
          open_violations: vs.length
        });
      } else if (!st.validated && new Date(s.updated_at) < staleCutoff) {
        stalled.push({
          session: s.id,
          stage: st.current,
          why: `no activity for ≥ ${STALE_DAYS}d, not validated`,
          since: s.updated_at
        });
      }
    }
    const runsHalted = runs
      .filter((r) => r.stopped_by_violation && violBySession.has(r.session_id))
      .map((r) => ({ session: r.session_id, query: r.query, when: r.created_at, violation: r.violation_id }));
    payload = { blocked, stalled: blockedOnly ? [] : stalled, runs_halted: runsHalted };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const blocks = [heading('MATRIYA-LITE — stuck points' + (blockedOnly ? ' (blocked only)' : ''))];
  if (!payload.blocked.length && !payload.stalled.length && !payload.runs_halted.length) {
    blocks.push('Nothing is currently blocked or visibly stalled. (Not the same as "all good".)');
    return render(blocks);
  }
  if (payload.blocked.length) {
    const t = table(
      ['session', 'stage', 'why', 'since', 'violation'],
      payload.blocked.map((i) => [shortId(i.session), i.stage || '—', i.why, ageFrom(i.since), i.violation ?? ''])
    );
    blocks.push(heading(`Blocked — the gate is closed (${payload.blocked.length})`) + '\n' + t);
  }
  if (payload.stalled.length) {
    const t = table(
      ['session', 'stage', 'why', 'since'],
      payload.stalled.map((i) => [shortId(i.session), i.stage || '(not started)', i.why, ageFrom(i.since)])
    );
    blocks.push(heading(`Stalled — quiet, not flagged, not finished (${payload.stalled.length})`) + '\n' + t);
  }
  if (payload.runs_halted.length) {
    const t = table(
      ['session', 'query', 'when', 'violation'],
      payload.runs_halted.map((r) => [shortId(r.session), String(r.query || '').slice(0, 44), ageFrom(r.when), r.violation ?? ''])
    );
    blocks.push(heading(`Research runs halted mid-flight (${payload.runs_halted.length})`) + '\n' + t);
  }
  blocks.push(bullet('This is where motion stopped. Whether — and how — it should resume is your call.'));
  return render(blocks);
}
