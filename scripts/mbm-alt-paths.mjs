/**
 * MBM Stage C.1 — Alternative Path Generator.
 *
 * Instead of one path, enumerate ALL physically-valid transition paths between
 * two material states and rank them by reliability. This is the step where the
 * model starts to behave like a scientist: "here are three mechanisms that
 * explain the data — this one is the most credible."
 *
 * Reuses everything below it: the transition graph, the 5 invariants (a path is
 * kept only if every step is physically consistent), and the Stage-B confidence
 * model. Reliability is a measurement, not a gate.
 *
 * Ranking metric — pathMRI. NOTE (a deliberate, documented choice): Stage-B path
 * confidence is a PRODUCT (compound end-to-end trust) which necessarily shrinks
 * with length. For COMPARING alternative explanations of the SAME endpoints, that
 * unfairly favours short/coarse routes. So ranking uses the length-neutral
 * GEOMETRIC MEAN of step confidences (average per-link trust) × validity ×
 * coverage. The compound product confidence and the weakest link are still
 * reported alongside.
 */
import { transitionConfidence, propagatePath } from './mbm-reliability.mjs';
import { checkInvariants, computeCoverage, INVARIANTS } from './mbm-invariants.mjs';

const REAL = (t) => t.status !== 'unknown' && t.status !== 'impossible';
const geoMean = (xs) => (xs.length ? Math.pow(xs.reduce((a, x) => a * x, 1), 1 / xs.length) : 0);

function scorePath(doc, ids) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const tx = ids.map((id) => byId[id]);
  const valid = checkInvariants({ states: doc.states, transitions: tx }).allOk;
  const prop = propagatePath(doc, ids);
  const cs = prop.steps.map((s) => s.c);
  const gm = Number(geoMean(cs).toFixed(4));
  const cov = computeCoverage({ states: doc.states, transitions: tx });
  const covFrac = cov.rows.filter((r) => r.exercised > 0).length / INVARIANTS.length;
  const pathMRI = Number((gm * (valid ? 1 : 0.5) * (0.5 + 0.5 * covFrac)).toFixed(4));
  return {
    ids, valid, pathMRI,
    stepGeoMean: gm,
    pathConfidence: prop.pathConfidence, // compound (product) — shrinks with length
    weakest: prop.weakest,
    coverageFraction: Number(covFrac.toFixed(2)),
    route: prop.steps.map((s) => s.to).length ? [byId[ids[0]].fromState, ...prop.steps.map((s) => s.to)] : []
  };
}

/**
 * @returns valid paths from `from` to `to` (or all maximal paths if `to` is null),
 * ranked by pathMRI descending. Simple paths only (no revisited states), bounded depth.
 */
export function generatePaths(doc, from, to = null, maxDepth = 8) {
  const outOf = {};
  for (const t of doc.transitions || []) if (REAL(t) && t.toState != null) (outOf[t.fromState] ||= []).push(t);
  const found = [];
  const dfs = (state, visited, acc) => {
    if (to != null && state === to && acc.length) { found.push([...acc]); return; }
    if (acc.length >= maxDepth) { if (to == null && acc.length) found.push([...acc]); return; }
    const outs = (outOf[state] || []).filter((t) => !visited.has(t.toState));
    if (outs.length === 0) { if (to == null && acc.length) found.push([...acc]); return; }
    for (const t of outs) dfs(t.toState, new Set([...visited, t.toState]), [...acc, t.id]);
  };
  dfs(from, new Set([from]), []);
  return found.map((ids) => scorePath(doc, ids)).filter((p) => p.valid).sort((a, b) => b.pathMRI - a.pathMRI);
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  console.log('MBM Alternative Path Generator — ranked explanations for app:solid → app:char\n');
  const paths = generatePaths(doc, 'app:solid', 'app:char');
  paths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.route.join(' → ')}`);
    console.log(`     pathMRI ${p.pathMRI}  |  avg-link ${p.stepGeoMean}  |  compound ${p.pathConfidence}  |  weakest: ${p.weakest.id} (${p.weakest.reason})`);
  });

  // self-consistency
  assert(paths.length === 3, `found 3 alternative routes (got ${paths.length})`);
  assert(paths.every((p) => p.valid), 'every returned path is physically valid (invariants pass)');
  assert(paths.every((p) => p.route[0] === 'app:solid' && p.route[p.route.length - 1] === 'app:char'), 'every path runs solid → char');
  for (let i = 1; i < paths.length; i++) assert(paths[i - 1].pathMRI >= paths[i].pathMRI, 'paths are ranked by pathMRI descending');
  const top = paths[0];
  assert(top.ids.join(',') === 'app_ppa1,app_ppa2', `top route is the well-evidenced polyphosphoric-acid path (got ${top.ids.join('→')})`);
  assert(paths[paths.length - 1].ids.join(',') === 'app_direct', 'weakest route is the coarse direct charring hypothesis');
  // an unreachable query returns nothing, not a fabricated path
  assert(generatePaths(doc, 'app:char', 'app:solid').length === 0, 'no fabricated path for an unreachable query (char → solid)');

  console.log('');
  if (fails) { console.error(`MBM Alternative Path Generator FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Alternative Path Generator PASSED — valid routes only, ranked by reliability, no fabrication.');
}
