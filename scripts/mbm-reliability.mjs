/**
 * MBM Reliability Layer (Stage B) — turns the Material Behavior Model from a
 * consistent model into a Scientific Reliability Engine: every conclusion carries
 * how much it can be trusted.
 *
 * Six layers per the Stage-B spec (layer 1, Invariant Coverage, lives in
 * mbm-invariants.mjs). This module adds the rest, all heuristic-by-design and
 * documented:
 *   2. Confidence          — per-transition c_i (status × source tier)
 *      Propagation         — path confidence = Π (w_i · c_i)  [weakest-link aware]
 *   3. MRI                 — Model Reliability Index = validity × coverage × confidence
 *   4. Evidence Sensitivity— which experiment would raise confidence most
 *   5. Explainability      — each transition explains itself (evidence/mechanism/invariants)
 *   6. Weakest-Link        — WHERE a path's confidence breaks, and WHY
 *
 * Reliability is a MEASUREMENT, not a gate — it never rejects a transition; it
 * reports trust. (The invariant suite is the gate.)
 */
import { checkInvariants, computeCoverage, INVARIANTS } from './mbm-invariants.mjs';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --- Layer 2a: per-transition confidence c_i --------------------------------
// Base by epistemic status, scaled by the tier of the best supporting evidence.
const STATUS_BASE = { replicated: 0.9, observed: 0.8, mechanism_supported: 0.7, predicted: 0.5, hypothesized: 0.3, unknown: 0.0, impossible: 0.0 };
const TIER = { tga: 1.0, dsc: 1.0, ftir: 1.0, xrd: 1.0, sem: 1.0, uv_vis: 1.0, tds: 0.95, sds: 0.95, standard: 0.95, scientific_paper: 0.8, patent: 0.75, literature: 0.7, illustrative: 0.6 };
const NO_EVIDENCE_TIER = 0.5; // inference only

function sourceTier(t) {
  const ev = t.evidence || [];
  if (ev.length === 0) return NO_EVIDENCE_TIER;
  return Math.max(...ev.map((e) => TIER[(e.documentType || '').toLowerCase()] ?? 0.6));
}

export function transitionConfidence(t) {
  const base = STATUS_BASE[t.status] ?? 0.3;
  const tier = sourceTier(t);
  const nEv = (t.evidence || []).length;
  const repBoost = nEv > 1 ? Math.min(0.1, 0.05 * (nEv - 1)) : 0; // multiple independent evidences
  const c = clamp01(base * tier + repBoost * base);
  return { c: Number(c.toFixed(4)), base, tier, evidenceCount: nEv };
}

function weakReason(t) {
  const reasons = [];
  if (['hypothesized', 'predicted'].includes(t.status)) reasons.push(`unvalidated (status: ${t.status})`);
  const ev = t.evidence || [];
  if (ev.length === 0) reasons.push('no evidence (inference only)');
  else {
    const tiers = ev.map((e) => (e.documentType || '').toLowerCase());
    if (ev.length === 1) reasons.push('single source');
    if (tiers.every((d) => ['literature', 'scientific_paper', 'illustrative'].includes(d))) reasons.push('no instrument confirmation (no TGA/DSC/FTIR/…)');
  }
  return reasons.join('; ') || 'well-supported';
}

// --- Layer 2b + 6: path propagation & weakest link --------------------------
export function propagatePath(doc, transitionIds, weights) {
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const steps = [];
  let prevTo = null;
  transitionIds.forEach((id, i) => {
    const t = byId[id];
    if (!t) throw new Error(`unknown transition '${id}'`);
    if (prevTo != null && t.fromState !== prevTo) throw new Error(`path not contiguous at '${id}': expected fromState '${prevTo}', got '${t.fromState}'`);
    prevTo = t.toState;
    const { c } = transitionConfidence(t);
    steps.push({ id, from: t.fromState, to: t.toState, c, w: weights ? (weights[i] ?? 1) : 1, reason: weakReason(t) });
  });
  const pathConfidence = Number(steps.reduce((acc, s) => acc * s.w * s.c, 1).toFixed(4));
  const weakest = steps.reduce((m, s) => (s.c < m.c ? s : m), steps[0]);
  return { steps, pathConfidence, weakest: { id: weakest.id, c: weakest.c, reason: weakest.reason } };
}

// --- Layer 5: transition explainability -------------------------------------
export function explainTransition(doc, id) {
  const t = (doc.transitions || []).find((x) => x.id === id);
  if (!t) throw new Error(`unknown transition '${id}'`);
  const inv = checkInvariants({ states: doc.states, transitions: [t] });
  const invStatus = {};
  for (const r of inv.results) {
    const exc = (t.invariantExceptions || []).some((x) => x.invariant === r.invariant);
    invStatus[r.invariant] = r.ok ? (exc ? 'exception' : 'ok') : 'VIOLATION';
  }
  return {
    id, from: t.fromState, to: t.toState, drivers: t.drivers, status: t.status,
    mechanism: t.mechanism ?? null,
    evidence: (t.evidence || []).map((e) => e.documentType || 'unspecified'),
    invariants: invStatus,
    confidence: transitionConfidence(t).c
  };
}

// --- Layer 4: evidence sensitivity (which experiment is worth doing) ---------
const INSTRUMENT_RELEVANCE = {
  temperature: ['tga', 'dsc'], radiation: ['ftir'], uv: ['ftir', 'uv_vis'], electric_field: ['electrochemical'],
  humidity: ['ftir', 'xrd'], pressure: ['sem'], mechanical_stress: ['sem'], ph: ['xrd'], chemical_agent: ['ftir', 'xrd'], time: []
};
const INSTRUMENTS = ['tga', 'dsc', 'ftir', 'xrd', 'sem', 'uv_vis'];

export function evidenceSensitivity(doc, id) {
  const t = (doc.transitions || []).find((x) => x.id === id);
  if (!t) throw new Error(`unknown transition '${id}'`);
  const current = transitionConfidence(t).c;
  const relevant = new Set((t.drivers || []).flatMap((d) => INSTRUMENT_RELEVANCE[d] || []));
  return INSTRUMENTS.map((instr) => {
    // A confirming instrument observation promotes an unvalidated transition to
    // 'observed' and adds tier-1 evidence. Irrelevant instruments barely move it.
    const hypo = relevant.has(instr)
      ? { ...t, status: ['hypothesized', 'predicted'].includes(t.status) ? 'observed' : t.status, evidence: [...(t.evidence || []), { documentType: instr }] }
      : { ...t, evidence: [...(t.evidence || []), { documentType: instr }] };
    const delta = Number((transitionConfidence(hypo).c - current).toFixed(4));
    return { instrument: instr, relevant: relevant.has(instr), deltaConfidence: Math.max(0, delta) };
  }).sort((a, b) => b.deltaConfidence - a.deltaConfidence);
}

// --- Layer 3: Model Reliability Index ---------------------------------------
export function modelReliabilityIndex(doc, transitionIds) {
  const prop = propagatePath(doc, transitionIds);
  const pathTx = transitionIds.map((id) => (doc.transitions || []).find((t) => t.id === id));
  const inv = checkInvariants({ states: doc.states, transitions: pathTx });
  const physicalValidity = inv.allOk;
  // path coverage: how many of the 5 invariants are exercised by some step
  const cov = computeCoverage({ states: doc.states, transitions: pathTx });
  const exercised = cov.rows.filter((r) => r.exercised > 0).length;
  const coverageFraction = exercised / INVARIANTS.length;
  const validityFactor = physicalValidity ? 1 : 0.5;
  const coverageFactor = 0.5 + 0.5 * coverageFraction;
  const mri = Number(clamp01(prop.pathConfidence * validityFactor * coverageFactor).toFixed(4));
  return { mri, physicalValidity, coverageFraction: Number(coverageFraction.toFixed(2)), pathConfidence: prop.pathConfidence, weakest: prop.weakest, steps: prop.steps };
}

// --- direct run: demo report + self-consistency checks -----------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  const paths = [
    { name: 'epoxy thermal (glassy→rubbery→degraded→char)', ids: ['thermal_1', 'thermal_2', 'thermal_3'] },
    { name: 'silane → photo-degradation (ends in a hypothesis)', ids: ['hydro_1', 'hydro_2', 'hyp_1'] }
  ];

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  console.log('MBM Reliability Layer — every conclusion carries its trust\n');
  for (const p of paths) {
    const r = modelReliabilityIndex(doc, p.ids);
    console.log(`Path: ${p.name}`);
    for (const s of r.steps) console.log(`  ${s.id.padEnd(10)} c=${s.c.toFixed(2)}${s.id === r.weakest.id ? '   ← weakest: ' + r.weakest.reason : ''}`);
    console.log(`  Path confidence = ${r.pathConfidence}   |   Physical validity: ${r.physicalValidity ? 'yes' : 'NO'}   |   Path coverage: ${(r.coverageFraction * 100).toFixed(0)}%`);
    console.log(`  MRI = ${r.mri}`);
    // self-consistency
    const minC = Math.min(...r.steps.map((s) => s.c));
    assert(r.pathConfidence <= minC + 1e-9, `${p.name}: path confidence ≤ weakest step`);
    assert(Math.abs(r.weakest.c - minC) < 1e-9, `${p.name}: weakest link is the min-confidence step`);
    assert(r.mri >= 0 && r.mri <= 1, `${p.name}: MRI in [0,1]`);
    console.log('');
  }

  // Evidence sensitivity on the weak link
  const sens = evidenceSensitivity(doc, 'hyp_1');
  console.log('Evidence sensitivity — hyp_1 (silane photo-degradation, unvalidated):');
  for (const s of sens.slice(0, 4)) console.log(`  ${s.instrument.padEnd(8)} Δconfidence ${s.deltaConfidence >= 0 ? '+' : ''}${s.deltaConfidence}${s.relevant ? '  (relevant)' : ''}`);
  const top = sens[0];
  assert(top.deltaConfidence > 0 && top.relevant, 'sensitivity: the best experiment is a relevant instrument with positive gain');
  // an already-observed, evidenced transition should have small max sensitivity vs the weak link
  const sensObserved = evidenceSensitivity(doc, 'thermal_1');
  assert(Math.max(...sensObserved.map((s) => s.deltaConfidence)) < Math.max(...sens.map((s) => s.deltaConfidence)), 'sensitivity: weak transition gains more from a new experiment than a well-supported one');

  // Explainability
  const ex = explainTransition(doc, 'thermal_2');
  console.log('\nExplainability — thermal_2:');
  console.log(`  ${ex.from} → ${ex.to} via "${ex.mechanism}" | evidence: ${ex.evidence.join(', ')} | invariants: ${Object.entries(ex.invariants).map(([k, v]) => k + '=' + v).join(', ')} | c=${ex.confidence}`);
  assert(ex.invariants.conservation_of_mass === 'exception', 'explainability: thermal_2 shows its conservation_of_mass exception');

  console.log('');
  if (fails) { console.error(`MBM Reliability Layer FAILED: ${fails} self-consistency check(s)`); process.exit(1); }
  console.log('MBM Reliability Layer PASSED — confidence propagation, weakest-link, MRI, sensitivity & explainability are self-consistent.');
}
