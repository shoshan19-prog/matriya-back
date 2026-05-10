/**
 * `matriya friction by-category` — where friction accumulated.
 *
 * Violations grouped by reason (the rule that fired). A tall bar means the
 * system kept tripping there. Why it trips, and whether it matters, is not in
 * this view.
 */
import { open, close, violations, noiseEvents } from '../lib/source.js';
import { heading, table, render, ageFrom, bullet } from '../lib/frame.js';

export async function frictionByCategory({ json = false } = {}) {
  await open();
  let payload;
  try {
    const [allViol, noise] = await Promise.all([violations({}), noiseEvents()]);
    const byCategory = new Map();
    for (const v of allViol) {
      const key = v.reason || v.type || 'unspecified';
      const c = byCategory.get(key) || { category: key, times: 0, still_open: 0, last_seen: null };
      c.times += 1;
      if (!v.resolved_at) c.still_open += 1;
      if (!c.last_seen || new Date(v.created_at) > new Date(c.last_seen)) c.last_seen = v.created_at;
      byCategory.set(key, c);
    }
    const byNoiseType = new Map();
    for (const n of noise) {
      const key = n.event_type || 'unspecified';
      const c = byNoiseType.get(key) || { type: key, count: 0, last_seen: null };
      c.count += 1;
      if (!c.last_seen || new Date(n.created_at) > new Date(c.last_seen)) c.last_seen = n.created_at;
      byNoiseType.set(key, c);
    }
    const categories = [...byCategory.values()].sort((a, b) => b.times - a.times || b.still_open - a.still_open);
    payload = {
      total_violations: allViol.length,
      total_open: categories.reduce((s, c) => s + c.still_open, 0),
      categories,
      noise_events_by_type: [...byNoiseType.values()].sort((a, b) => b.count - a.count)
    };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const blocks = [heading('MATRIYA-LITE — friction by category')];
  if (payload.total_violations === 0) {
    blocks.push('No friction recorded. Either it has been quiet, or it has not been measured here.');
  } else {
    blocks.push(
      `${payload.total_violations} violation(s) across ${payload.categories.length} categor${payload.categories.length === 1 ? 'y' : 'ies'}; ${payload.total_open} still open.`
    );
    blocks.push(
      table(
        ['category', 'times', 'still open', 'last seen'],
        payload.categories.map((c) => [c.category, c.times, c.still_open || '', ageFrom(c.last_seen)])
      )
    );
    blocks.push(bullet('A tall bar = the system kept tripping here. The cause, and whether it matters, is not in this view.'));
  }
  if (payload.noise_events_by_type.length) {
    blocks.push(
      heading('Re-evaluation backlog (noise events)') +
        '\n' +
        table(['event type', 'count', 'last seen'], payload.noise_events_by_type.map((n) => [n.type, n.count, ageFrom(n.last_seen)]))
    );
  }
  return render(blocks);
}
