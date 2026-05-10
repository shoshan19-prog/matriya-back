/**
 * MATRIYA-LITE — shared lenses on the data. No DB access, no presentation:
 * just the small derivations several commands need to agree on.
 */

/** Stale threshold for "silent" sessions, in days. Override with MATRIYA_LITE_STALE_DAYS. */
export const STALE_DAYS = (() => {
  const n = Number(process.env.MATRIYA_LITE_STALE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
})();

/** Default review window, in days. */
export const WEEK_DAYS = 7;

export function daysAgo(n, fromMs = Date.now()) {
  return new Date(fromMs - n * 24 * 60 * 60 * 1000);
}

/**
 * Where a research session sits on the K→C→B→N→L pass.
 * @param {object} session - ResearchSession row (completed_stages: string[])
 * @param {string[]} stagesOrder - canonical stage order
 * @returns {{ done: string[], validated: boolean, current: string|null, awaiting: string|null }}
 */
export function stageOf(session, stagesOrder) {
  const done = Array.isArray(session?.completed_stages) ? session.completed_stages : [];
  let current = null;
  for (const s of stagesOrder) {
    if (done.includes(s)) current = s;
  }
  const awaiting = stagesOrder.find((s) => !done.includes(s)) || null;
  return { done, validated: done.includes('L'), current, awaiting };
}
