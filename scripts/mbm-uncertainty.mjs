/**
 * MBM Stage C.2 — Uncertainty Attribution.
 *
 * Returning "MRI = 0.21" is not enough. This decomposes the uncertainty into
 * named, actionable sources so the user knows *where to invest* to raise trust —
 * and each dominant source maps to a concrete next action (bridging toward C.3/C.4).
 *
 * Decomposition. A transition's confidence is c_i = base(status) × tier(evidence),
 * so its shortfall factors CLEANLY into two independent parts:
 *   1 − c_i = (1 − base)   [Model Gap  — not yet observed/validated]
 *           + base·(1 − tier) [Evidence  — weak/absent source]
 * At the path level the four uncertainty sources are:
 *   • modelGap  — mean status shortfall (unvalidated transitions)
 *   • evidence  — mean evidence-tier shortfall (source quality)
 *   • coverage  — invariants not exercised along the path
 *   • weakLink  — imbalance: how much one bottleneck step dominates (max − min c)
 * These are reported as a RELATIVE attribution (normalised to 100%) — a lens on
 * where uncertainty concentrates, not an exact additive identity (documented).
 */
import { transitionConfidence, modelReliabilityIndex } from './mbm-reliability.mjs';
import { computeCoverage } from './mbm-invariants.mjs';

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function attributeUncertainty(doc, ids) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const tx = ids.map((id) => byId[id]);
  const mriObj = modelReliabilityIndex(doc, ids);
  const steps = tx.map((t) => { const { c, base, tier } = transitionConfidence(t); return { id: t.id, status: t.status, c, base, tier }; });

  const raw = {
    coverage: 1 - mriObj.coverageFraction,
    evidence: mean(steps.map((s) => s.base * (1 - s.tier))),
    weakLink: Math.max(...steps.map((s) => s.c)) - Math.min(...steps.map((s) => s.c)),
    modelGap: mean(steps.map((s) => 1 - s.base))
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const components = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number((100 * v / sum).toFixed(1))]));
  const dominant = Object.entries(components).sort((a, b) => b[1] - a[1])[0][0];

  const weakest = mriObj.weakest;
  const unvalidated = steps.filter((s) => ['hypothesized', 'predicted'].includes(s.status)).map((s) => s.id);
  const untested = computeCoverage({ states: doc.states, transitions: tx }).rows.filter((r) => r.exercised === 0).map((r) => r.invariant);
  const recommendation = {
    modelGap: unvalidated.length ? `validate the unvalidated step(s): ${unvalidated.join(', ')} — observe to raise status` : `raise the weakest step ${weakest.id} above hypothesis`,
    evidence: `add instrument evidence (TGA/DSC/FTIR) on ${weakest.id} — raises its source tier`,
    coverage: untested.length ? `exercise the untested invariant(s): ${untested.join(', ')}` : 'broaden invariant coverage on this path',
    weakLink: `the path is bottlenecked by ${weakest.id} (${weakest.reason}) — target it specifically`
  }[dominant];

  return { ids, mri: mriObj.mri, components, dominant, recommendation, weakest };
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
  const ORDER = ['coverage', 'evidence', 'weakLink', 'modelGap'];

  console.log('MBM Uncertainty Attribution — WHY the model is (un)certain\n');
  for (const p of [
    { name: 'crosslink route (app:solid → crosslinked → char)', ids: ['app_xl1', 'app_xl2'] },
    { name: 'polyphosphoric-acid route (app:solid → PPA → char)', ids: ['app_ppa1', 'app_ppa2'] }
  ]) {
    const a = attributeUncertainty(doc, p.ids);
    console.log(`Path: ${p.name}`);
    console.log(`  MRI = ${a.mri}`);
    for (const k of ORDER) console.log(`    ${k.padEnd(9)} ${String(a.components[k]).padStart(5)}%${k === a.dominant ? '   ← dominant' : ''}`);
    console.log(`  → ${a.recommendation}\n`);

    const total = ORDER.reduce((s, k) => s + a.components[k], 0);
    assert(Math.abs(total - 100) < 0.5, `${p.name}: components sum to 100% (got ${total.toFixed(1)})`);
    assert(ORDER.every((k) => a.components[k] >= 0), `${p.name}: all components non-negative`);
    assert(a.components[a.dominant] === Math.max(...ORDER.map((k) => a.components[k])), `${p.name}: dominant is the largest component`);
    assert(typeof a.recommendation === 'string' && a.recommendation.length > 0, `${p.name}: emits an actionable recommendation`);
  }

  if (fails) { console.error(`MBM Uncertainty Attribution FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Uncertainty Attribution PASSED — uncertainty decomposed into 4 sources (sum 100%) with an actionable lever.');
}
