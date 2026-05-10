/**
 * `matriya debt list [--open] [--all]` — what open debt is parked.
 *
 * Open debt here = unresolved violations (each is something the system noticed
 * and held), plus noise events explicitly deferred for re-evaluation after a
 * future kernel version. --open is the default; --all also shows resolved items
 * for context. The list does not rank items or say which to pay down first.
 */
import { open, close, violations, noiseEvents } from '../lib/source.js';
import { heading, table, render, shortId, ageFrom, bullet } from '../lib/frame.js';

function detailHint(d) {
  if (!d || typeof d !== 'object') return '';
  const parts = [];
  if (d.metric_value != null) parts.push(`|M|=${d.metric_value}`);
  if (d.previous_value != null) parts.push(`prev=${d.previous_value}`);
  if (d.threshold != null) parts.push(`thr≈${Math.round(d.threshold)}`);
  if (d.drop_percent != null) parts.push(`drop=${Math.round(d.drop_percent)}%`);
  if (d.cycles != null) parts.push(`cycles=${d.cycles}`);
  return parts.join(' ');
}

export async function debtList({ json = false, includeResolved = false } = {}) {
  await open();
  let payload;
  try {
    const [viol, noise] = await Promise.all([violations({ openOnly: !includeResolved }), noiseEvents()]);
    const deferred = noise.filter((n) => n.re_evaluate_after_kernel_version);
    payload = {
      violations: viol.map((v) => ({
        id: v.id,
        session: v.session_id,
        kind: v.reason || v.type,
        opened: v.created_at,
        resolved_at: v.resolved_at || null,
        detail: detailHint(v.details)
      })),
      deferred_reevaluation: deferred.map((n) => ({
        session: n.session_id,
        event: n.event_type,
        classified_under: n.kernel_version_at_classification || null,
        revisit_after: n.re_evaluate_after_kernel_version,
        since: n.created_at
      }))
    };
  } finally {
    await close();
  }

  if (json) return JSON.stringify(payload, null, 2);

  const open_count = payload.violations.filter((v) => !v.resolved_at).length;
  const blocks = [heading('MATRIYA-LITE — open debt' + (includeResolved ? ' (incl. resolved)' : ''))];
  if (!payload.violations.length && !payload.deferred_reevaluation.length) {
    blocks.push('No open debt on record. Nothing flagged is waiting on you here.');
    return render(blocks);
  }
  if (payload.violations.length) {
    const t = table(
      ['#', 'session', 'kind', 'opened', 'state', 'detail'],
      payload.violations.map((v) => [
        v.id,
        shortId(v.session),
        v.kind,
        ageFrom(v.opened),
        v.resolved_at ? `resolved ${ageFrom(v.resolved_at)}` : 'open',
        v.detail
      ])
    );
    blocks.push(heading(`Violations (${open_count} open)`) + '\n' + t);
  }
  if (payload.deferred_reevaluation.length) {
    const t = table(
      ['session', 'event', 'classified under', 'revisit after', 'since'],
      payload.deferred_reevaluation.map((n) => [shortId(n.session), n.event, n.classified_under || '—', n.revisit_after, ageFrom(n.since)])
    );
    blocks.push(heading(`Deferred re-evaluation (${payload.deferred_reevaluation.length})`) + '\n' + t);
  }
  blocks.push(bullet('Each row is something the system noticed and parked. It does not rank them or tell you which to clear first.'));
  return render(blocks);
}
