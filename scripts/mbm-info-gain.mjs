/**
 * MBM Stage C.3 — Information Gain Engine.
 *
 * C.2 answered "WHY am I uncertain?" (diagnosis). C.3 answers a DIFFERENT
 * question — "which experiment would reduce that uncertainty the most?"
 * (valuation). It deliberately does NOT choose an experiment: it *quantifies the
 * information value* of each candidate. Choosing a portfolio under cost/time is
 * C.4 (Experiment Planner). Keeping valuation and planning apart is what keeps
 * the architecture clean.
 *
 * How the value is measured — counterfactual re-simulation, not an invented
 * number. Each candidate is an epistemic upgrade to an EXISTING transition (no
 * new chemistry is fabricated):
 *   • observe(T)     — a confirming observation promotes status → 'observed'
 *                      (raises base). Attacks the modelGap component.
 *   • instrument(T)  — a relevant instrument (TGA/DSC/FTIR/…) adds tier-1
 *                      evidence and promotes an unvalidated step. Attacks the
 *                      evidence component (and modelGap if it was a hypothesis).
 * We apply the projected effect to a copy of the model, re-run C.2, and report
 * the change. Δ per component comes straight from C.2's raw magnitudes, so C.3
 * literally consumes C.2's output.
 *
 * Honest framing — this is the CORROBORATION-case value: it assumes the
 * experiment yields its intended effect. A refuting result (surprise) can raise
 * uncertainty instead; that branch is a later stage (Surprise Analysis), not
 * this one. Documented, not hidden.
 *
 * Guardrail: ΔMRI measures *reduction*, never an absolute-MRI gate. MRI stays a
 * summary metric; decisions rest on the decomposition, not on the number.
 */
import { attributeUncertainty } from './mbm-uncertainty.mjs';
import { transitionConfidence } from './mbm-reliability.mjs';
import { generatePaths } from './mbm-alt-paths.mjs';

// Relevant instrument per driver (mirrors the reliability layer's mapping).
const INSTRUMENT_RELEVANCE = {
  temperature: ['tga', 'dsc'], radiation: ['ftir'], uv: ['ftir', 'uv_vis'], electric_field: ['electrochemical'],
  humidity: ['ftir', 'xrd'], pressure: ['sem'], mechanical_stress: ['sem'], ph: ['xrd'], chemical_agent: ['ftir', 'xrd'], time: []
};
// Illustrative cost (materials/effort) and time (days) per experiment kind.
// Placeholder units — real values arrive with the lab's own data. Reported for
// C.4 to optimise against; C.3 does NOT rank by them.
const COST_TIME = {
  observe: { cost: 1, time: 2 },
  tga: { cost: 2, time: 3 }, dsc: { cost: 2, time: 3 }, ftir: { cost: 2, time: 2 },
  xrd: { cost: 3, time: 3 }, sem: { cost: 3, time: 4 }, uv_vis: { cost: 1, time: 1 }
};
const UNVALIDATED = (s) => s === 'hypothesized' || s === 'predicted';

// Build the modified model with `target` replaced by `patch`.
const withPatch = (doc, target, patch) => ({
  states: doc.states,
  transitions: (doc.transitions || []).map((t) => (t.id === target ? { ...t, ...patch } : t))
});

// Candidate experiments derived from the path's own deficits (no fabrication).
function candidatesFor(doc, ids) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const out = [];
  for (const id of ids) {
    const t = byId[id];
    const { tier } = transitionConfidence(t);
    // observe: only meaningful if the step is not yet observed-or-better.
    if (UNVALIDATED(t.status)) {
      out.push({ id: `observe:${id}`, kind: 'observe', target: id, instrument: null, projects: 'status → observed', ...COST_TIME.observe });
    }
    // instrument: only if a relevant instrument exists and evidence isn't already tier-1.
    const relevant = [...new Set((t.drivers || []).flatMap((d) => INSTRUMENT_RELEVANCE[d] || []))].filter((i) => COST_TIME[i]);
    if (relevant.length && tier < 1.0) {
      const instr = relevant[0];
      out.push({ id: `instrument:${id}:${instr}`, kind: 'instrument', target: id, instrument: instr, projects: `add ${instr.toUpperCase()} (tier-1)${UNVALIDATED(t.status) ? ' + status → observed' : ''}`, ...COST_TIME[instr] });
    }
  }
  return out;
}

function applyCandidate(doc, cand) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const t = byId[cand.target];
  if (cand.kind === 'observe') return withPatch(doc, cand.target, { status: 'observed' });
  // instrument: add tier-1 evidence; promote an unvalidated step to observed.
  const evidence = [...(t.evidence || []), { documentType: cand.instrument }];
  const status = UNVALIDATED(t.status) ? 'observed' : t.status;
  return withPatch(doc, cand.target, { evidence, status });
}

/**
 * @returns {{ ids, before, candidates }} where candidates are ranked by expected
 * ΔMRI (information value) descending. Each carries per-component reduction, the
 * competing mechanisms it would move, and cost/time metadata for C.4.
 */
export function informationGain(doc, ids) {
  const before = attributeUncertainty(doc, ids);
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const from = byId[ids[0]].fromState;
  const to = byId[ids[ids.length - 1]].toState;
  const alts = generatePaths(doc, from, to);

  const cands = candidatesFor(doc, ids).map((cand) => {
    const after = attributeUncertainty(applyCandidate(doc, cand), ids);
    const deltaMRI = Number((after.mri - before.mri).toFixed(4));
    const reduces = Object.fromEntries(Object.keys(before.raw).map((k) => [k, Number((before.raw[k] - after.raw[k]).toFixed(4))]));
    // The dominant component this experiment actually attacks.
    const attacks = Object.entries(reduces).sort((a, b) => b[1] - a[1])[0][0];
    // Competing mechanisms: alternative routes (same endpoints) that include the target.
    const competing = alts.filter((p) => p.ids.includes(cand.target)).map((p) => p.route.join(' → '));
    const costTime = cand.cost * cand.time;
    return {
      id: cand.id, kind: cand.kind, target: cand.target, instrument: cand.instrument, projects: cand.projects,
      deltaMRI, attacks, reduces,
      competingResolved: competing,
      cost: cand.cost, time: cand.time,
      efficiency: Number((deltaMRI / costTime).toFixed(4)) // for C.4 (IG ÷ cost×time), NOT used for ranking here
    };
  }).sort((a, b) => b.deltaMRI - a.deltaMRI);

  return { ids, before: { mri: before.mri, dominant: before.dominant, components: before.components }, candidates: cands };
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

  console.log('MBM Information Gain — value of each experiment (C.3 quantifies; C.4 will choose)\n');
  const scenarios = [
    { name: 'crosslink route (app:solid → crosslinked → char)', ids: ['app_xl1', 'app_xl2'] },
    { name: 'polyphosphoric-acid route (app:solid → PPA → char)', ids: ['app_ppa1', 'app_ppa2'] }
  ];
  const results = {};
  for (const s of scenarios) {
    const r = informationGain(doc, s.ids);
    results[s.ids.join(',')] = r;
    console.log(`Path: ${s.name}`);
    console.log(`  before: MRI=${r.before.mri}  dominant=${r.before.dominant}`);
    r.candidates.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.kind} ${c.target}${c.instrument ? ' (' + c.instrument.toUpperCase() + ')' : ''} — ${c.projects}`);
      console.log(`     ΔMRI +${c.deltaMRI}  attacks:${c.attacks}  reduces{ ${Object.entries(c.reduces).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(', ')} }  cost×time=${c.cost}×${c.time}  eff=${c.efficiency}`);
      if (c.competingResolved.length) console.log(`     decides among: ${c.competingResolved.length} competing route(s)`);
    });
    console.log('');

    // self-consistency
    assert(r.candidates.length > 0, `${s.name}: at least one candidate experiment`);
    assert(r.candidates.every((c) => c.deltaMRI >= 0), `${s.name}: no candidate lowers MRI in the corroboration case`);
    for (let i = 1; i < r.candidates.length; i++) assert(r.candidates[i - 1].deltaMRI >= r.candidates[i].deltaMRI, `${s.name}: ranked by ΔMRI descending`);
    assert(r.candidates[0].deltaMRI > 0, `${s.name}: the best experiment yields real information gain`);
  }

  // C.2 diagnosis → C.3 target: the crosslink route's dominant deficit is modelGap,
  // and the top experiment must actually attack modelGap on the hypothesized step.
  const xl = results['app_xl1,app_xl2'];
  assert(xl.before.dominant === 'modelGap', 'crosslink route diagnosed as modelGap-dominant (C.2)');
  assert(xl.candidates.some((c) => c.target === 'app_xl2' && c.reduces.modelGap > 0), 'an experiment on the hypothesized step app_xl2 reduces modelGap');
  assert(xl.candidates[0].target === 'app_xl2', 'the highest-value experiment targets the weakest step (app_xl2)');

  // The PPA route's dominant deficit is evidence; an instrument on app_ppa2 must
  // attack the evidence component.
  const ppa = results['app_ppa1,app_ppa2'];
  assert(ppa.before.dominant === 'evidence', 'PPA route diagnosed as evidence-dominant (C.2)');
  const instr = ppa.candidates.find((c) => c.kind === 'instrument' && c.target === 'app_ppa2');
  assert(instr && instr.reduces.evidence > 0, 'a TGA/DSC experiment on app_ppa2 reduces the evidence component');

  // Diagnosis vs planning stay separate: ranking here is by ΔMRI, independent of cost.
  assert(xl.candidates.every((c) => 'efficiency' in c && 'cost' in c), 'cost/time & efficiency reported for C.4, but ranking is by ΔMRI');

  if (fails) { console.error(`MBM Information Gain FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Information Gain PASSED — each experiment valued by expected ΔMRI & per-component reduction; C.2 diagnosis maps to the right experiment; selection left to C.4.');
}
