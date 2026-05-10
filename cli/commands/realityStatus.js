/**
 * `matriya reality status` — what is still UNVERIFIED in the universe.
 *
 * A research session is "verified" only once it has completed the K→C→B→N→L
 * pass (stage L). Everything else is shown as unverified — which means the
 * picture is not yet confirmed, not that it is wrong.
 */
import { open, close, sessions, violations, STAGES_ORDER } from '../lib/source.js';
import { heading, table, render, shortId, ageFrom, bullet } from '../lib/frame.js';
import { stageOf } from '../lib/lens.js';

export async function realityStatus({ json = false } = {}) {
  await open();
  let payload;
  try {
    const [all, openViol] = await Promise.all([sessions(), violations({ openOnly: true })]);
    const held = new Set(openViol.map((v) => v.session_id));
    const rows = all.map((s) => {
      const st = stageOf(s, STAGES_ORDER);
      return { id: s.id, ...st, held: held.has(s.id), updated_at: s.updated_at };
    });
    const unverified = rows.filter((r) => !r.validated);
    payload = {
      total: rows.length,
      validated: rows.length - unverified.length,
      unverified: unverified.length,
      held_by_open_violation: rows.filter((r) => r.held).length,
      unverified_sessions: unverified.map((r) => ({
        session: r.id,
        at_stage: r.current,
        awaiting_stage: r.awaiting,
        held_by_open_violation: r.held,
        last_activity: r.updated_at
      }))
    };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const blocks = [heading('MATRIYA-LITE — reality status')];
  if (payload.total === 0) {
    blocks.push('No research sessions on record. Nothing has entered the universe yet.');
    return render(blocks);
  }
  blocks.push(
    [
      `${payload.total} session(s) in the universe.`,
      `${payload.validated} reached validation (L).`,
      `${payload.unverified} still UNVERIFIED` +
        (payload.held_by_open_violation ? ` · ${payload.held_by_open_violation} held by an open violation` : '') +
        '.'
    ].join('\n')
  );
  if (payload.unverified_sessions.length) {
    const t = table(
      ['session', 'at stage', 'awaiting', 'held', 'last activity'],
      payload.unverified_sessions.map((u) => [
        shortId(u.session),
        u.at_stage || '(not started)',
        u.awaiting_stage || '—',
        u.held_by_open_violation ? 'yes' : '',
        ageFrom(u.last_activity)
      ])
    );
    blocks.push(heading('Unverified — where the picture is not yet confirmed') + '\n' + t);
  }
  blocks.push(bullet('"Unverified" = the K→C→B→N→L pass has not completed. It does not mean the work is wrong.'));
  return render(blocks);
}
