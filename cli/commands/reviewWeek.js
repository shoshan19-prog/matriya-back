/**
 * `matriya review week` — the last 7 days, in numbers, plus where the system
 * suggests you look.
 *
 * "Recommendations" here means "places worth your attention", each tied to a
 * concrete observation in the data. Nothing here is an instruction; the system
 * does not decide for you. (Acting on these — or having the system act — would
 * be a different, and deliberately gated, capability.)
 */
import { open, close, sessions, violations, snapshots, decisions, loopRuns } from '../lib/source.js';
import { heading, render, bullet, signal, ageFrom } from '../lib/frame.js';
import { daysAgo, WEEK_DAYS } from '../lib/lens.js';

export async function reviewWeek({ json = false, days = WEEK_DAYS } = {}) {
  await open();
  let payload;
  try {
    const since = daysAgo(days);
    const [allSessions, allViol, allSnaps, recentDecisions, recentRuns] = await Promise.all([
      sessions(),
      violations({}),
      snapshots(),
      decisions({ since }),
      loopRuns({ since })
    ]);
    const inWindow = (d) => d != null && new Date(d) >= since;
    const newSessions = allSessions.filter((s) => inWindow(s.created_at));
    const newViol = allViol.filter((v) => inWindow(v.created_at));
    const resolvedViol = allViol.filter((v) => v.resolved_at && inWindow(v.resolved_at));
    const openViol = allViol.filter((v) => !v.resolved_at);
    const sessionsWithSnaps = new Set(allSnaps.map((s) => s.session_id));
    const newSessionsNoEvidence = newSessions.filter((s) => !sessionsWithSnaps.has(s.id));
    const haltedRuns = recentRuns.filter((r) => r.stopped_by_violation);

    const catCount = new Map();
    for (const v of newViol) {
      const k = v.reason || v.type || 'unspecified';
      catCount.set(k, (catCount.get(k) || 0) + 1);
    }
    const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const oldestOpen = openViol.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0] || null;

    let allow = 0;
    let hold = 0;
    let other = 0;
    for (const d of recentDecisions) {
      const dec = String(d.decision || '').toLowerCase();
      if (dec.includes('allow')) allow += 1;
      else if (dec.includes('deny') || dec.includes('block') || dec.includes('stop') || dec.includes('lock')) hold += 1;
      else other += 1;
    }

    const where_to_look = [];
    if (!newViol.length && !newSessions.length && !recentDecisions.length) {
      where_to_look.push(['no-data', `Nothing was recorded in the last ${days}d. If work happened, it was not landing in this store — worth checking why.`]);
    }
    if (topCat && topCat[1] >= 2) {
      where_to_look.push(['recurring', `"${topCat[0]}" tripped ${topCat[1]}× this week. A pattern that repeats this fast usually rewards a look at its trigger.`]);
    }
    if (oldestOpen) {
      where_to_look.push(['ageing', `Oldest open violation (#${oldestOpen.id}, ${oldestOpen.reason || oldestOpen.type}) has been open since ${ageFrom(oldestOpen.created_at)}. It is not getting newer on its own.`]);
    }
    if (newSessionsNoEvidence.length) {
      where_to_look.push(['no-data', `${newSessionsNoEvidence.length} new session(s) this week have no |M| snapshot yet — the integrity layer has nothing to compare on them.`]);
    }
    if (!resolvedViol.length && openViol.length) {
      where_to_look.push(['backlog', `${openViol.length} violation(s) open, 0 resolved this week — the backlog held steady or grew.`]);
    } else if (resolvedViol.length) {
      where_to_look.push(['moved', `${resolvedViol.length} violation(s) cleared this week — visible movement on the backlog.`]);
    }
    if (haltedRuns.length) {
      where_to_look.push(['halt', `${haltedRuns.length} research run(s) stopped on a violation this week. Each is a question the system declined to answer until something is handled.`]);
    }

    payload = {
      window_days: days,
      since: since.toISOString(),
      counts: {
        new_sessions: newSessions.length,
        new_violations: newViol.length,
        resolved_violations: resolvedViol.length,
        open_violations_now: openViol.length,
        gate_decisions_logged: recentDecisions.length,
        gate_allow: allow,
        gate_hold: hold,
        gate_other: other,
        research_runs: recentRuns.length,
        research_runs_halted: haltedRuns.length,
        new_sessions_without_evidence: newSessionsNoEvidence.length
      },
      top_friction_this_week: topCat ? { category: topCat[0], times: topCat[1] } : null,
      oldest_open_violation: oldestOpen ? { id: oldestOpen.id, kind: oldestOpen.reason || oldestOpen.type, opened: oldestOpen.created_at } : null,
      where_to_look: where_to_look.map(([tag, text]) => ({ tag, text }))
    };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const c = payload.counts;
  const blocks = [heading(`MATRIYA-LITE — review (last ${payload.window_days}d)`)];
  blocks.push(
    [
      'In numbers:',
      `  sessions started: ${c.new_sessions}`,
      `  violations — opened: ${c.new_violations} · resolved: ${c.resolved_violations} · open now: ${c.open_violations_now}`,
      `  gate decisions logged: ${c.gate_decisions_logged} (allow ${c.gate_allow} / hold ${c.gate_hold} / other ${c.gate_other})`,
      `  research runs: ${c.research_runs} · halted on a violation: ${c.research_runs_halted}`,
      `  top friction: ${payload.top_friction_this_week ? `${payload.top_friction_this_week.category} (${payload.top_friction_this_week.times}×)` : '—'}`
    ].join('\n')
  );
  if (payload.where_to_look.length) {
    blocks.push(heading('Where the system suggests you look') + '\n' + payload.where_to_look.map((l) => signal(l.tag, l.text)).join('\n'));
  } else {
    blocks.push('Nothing in the data stands out enough this week to point at. An observation — not a guarantee.');
  }
  blocks.push(bullet('Prompts, not instructions. "Recommendation" here = "a place worth your attention". The system is not deciding for you.'));
  return render(blocks);
}
