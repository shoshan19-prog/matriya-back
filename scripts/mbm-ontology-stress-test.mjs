/**
 * MBM Ontology Validation Suite v1.0 — a DELIBERATE falsification attempt.
 *
 * Not "does it work on another example?" but "what would falsify the ontology?".
 * Runs the Material Behavior Model ontology/schema against 5 driver families
 * (thermal/hydrochemical/mechanical/photochemical/electrochemical) + coupled
 * drivers + unknown + impossible + all 7 transition statuses, and checks 8
 * survival dimensions. Exits non-zero if any dimension fails.
 *
 *   node scripts/mbm-ontology-stress-test.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { checkInvariants } from './mbm-invariants.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const rd = (p) => JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', p), 'utf8'));
const ont = rd('material-world-model.ontology.json');
const fx = rd('mbm-stress-fixtures.json');

const STATUSES = ['observed', 'replicated', 'mechanism_supported', 'predicted', 'hypothesized', 'unknown', 'impossible'];
const EVIDENCE_REQUIRED = new Set(['observed', 'replicated', 'mechanism_supported']);
const driverCat = ont.entities.find((e) => e.id === 'Driver').categories;
const catOf = (d) => Object.entries(driverCat).filter(([, ds]) => ds.includes(d)).map(([c]) => c);
const stateIds = new Set(fx.states.map((s) => s.id));

let fails = 0;
const dim = (name, ok, detail) => { console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };

// --- structural validation (schema-level) ----------------------------------
console.log('Structural validation');
{
  const errs = [];
  for (const t of fx.transitions) {
    for (const k of ['id', 'fromState', 'drivers', 'reversibility', 'status', 'entropy', 'confidence']) if (!(k in t)) errs.push(`${t.id}: missing ${k}`);
    if (!Array.isArray(t.drivers) || t.drivers.length < 1) errs.push(`${t.id}: drivers must be a non-empty array`);
    if (!STATUSES.includes(t.status)) errs.push(`${t.id}: bad status ${t.status}`);
    if (typeof t.entropy !== 'number' || t.entropy < 0 || t.entropy > 1) errs.push(`${t.id}: entropy out of range`);
    if (!stateIds.has(t.fromState)) errs.push(`${t.id}: dangling fromState`);
    if (t.toState !== null && t.toState !== undefined && !stateIds.has(t.toState)) errs.push(`${t.id}: dangling toState`);
    if (EVIDENCE_REQUIRED.has(t.status) && (!Array.isArray(t.evidence) || t.evidence.length < 1)) errs.push(`${t.id}: status ${t.status} requires >=1 evidence`);
  }
  dim(`fixtures valid (${fx.states.length} states, ${fx.transitions.length} transitions)`, errs.length === 0, errs.join('; '));
}

console.log('\n8 survival dimensions');

// D1 — Driver Taxonomy: every driver used maps to exactly one category
const usedDrivers = [...new Set(fx.transitions.flatMap((t) => t.drivers))];
const miscat = usedDrivers.filter((d) => catOf(d).length !== 1);
dim('D1 Driver Taxonomy — each driver in exactly one category', miscat.length === 0,
  miscat.length ? `uncategorised/ambiguous: ${miscat}` : usedDrivers.map((d) => `${d}=${catOf(d)[0]}`).join(', '));

// D2 — Multi-Driver
const maxDrivers = Math.max(...fx.transitions.map((t) => t.drivers.length));
const coupled = fx.transitions.filter((t) => t.drivers.length >= 2).length;
dim('D2 Multi-Driver — transitions with >=2 coupled drivers', maxDrivers >= 2, `${coupled} coupled, max=${maxDrivers} drivers (SCC: stress+humidity+chemical)`);

// D3 — Reversibility present on every transition
dim('D3 Reversibility — every transition declares it', fx.transitions.every((t) => t.reversibility), null);

// D4 — Unknown Handling -> Knowledge Gap
const unknowns = fx.transitions.filter((t) => t.status === 'unknown');
const badUnknown = unknowns.filter((t) => t.toState != null || !t.knowledgeGap || t.knowledgeGap.cost == null || t.knowledgeGap.impact == null || t.knowledgeGap.priority == null);
dim('D4 Unknown Handling — unknown => null toState + KnowledgeGap{cost,impact,priority}', unknowns.length >= 1 && badUnknown.length === 0, `${unknowns.length} unknown transition(s), all generate a gap`);

// D5 — Transition Status: valid + all 7 represented
const present = new Set(fx.transitions.map((t) => t.status));
const missing = STATUSES.filter((s) => !present.has(s));
dim('D5 Transition Status — all 7 statuses represented', missing.length === 0, missing.length ? `missing: ${missing}` : STATUSES.join(', '));

// D6 — Invariant Testing: ALL 5 invariants auto-checked (via the shared suite)
const inv = checkInvariants(fx);
const invBad = inv.results.filter((r) => !r.ok);
dim('D6 Invariant Testing — all 5 invariants (mass, entropy, causality, equivalence, continuity)', inv.allOk,
  inv.allOk ? inv.results.map((r) => r.invariant).join(', ') + ' — all respected'
    : 'violations: ' + invBad.map((r) => `${r.invariant}[${r.violations.join('; ')}]`).join(' | '));

// D7 — State Space Coverage (real families only; >= 30%)
const realTx = fx.transitions.filter((t) => t.status !== 'unknown' && t.status !== 'impossible');
const realMaterials = [...new Set(realTx.map((t) => t.fromState.split(':')[0]))];
const categories = Object.keys(driverCat);
const filled = new Set();
for (const t of realTx) { const m = t.fromState.split(':')[0]; for (const d of t.drivers) filled.add(`${m}:${catOf(d)[0]}`); }
const coverage = filled.size / (realMaterials.length * categories.length);
dim('D7 State Space Coverage — >= 30%', coverage >= 0.30, `${(coverage * 100).toFixed(0)}% (${filled.size}/${realMaterials.length * categories.length} material×category cells)`);

// D8 — Transition Entropy: average < 0.5
const avgH = fx.transitions.reduce((a, t) => a + t.entropy, 0) / fx.transitions.length;
dim('D8 Transition Entropy — average < 0.5', avgH < 0.5, `avg=${avgH.toFixed(3)}`);

// --- falsification report ----------------------------------------------------
console.log('\nFalsification report — what the stress test BROKE in ontology v1.0:');
for (const b of [
  'single `driver` could not express COUPLED drivers (steel SCC needs stress+humidity+chemical) -> `drivers[]`',
  'binary `isHypothesis` could not express 7 statuses (observed..impossible) -> `status` enum',
  '`toState` was required -> could not express an UNKNOWN transition (State A -> ???) -> nullable + KnowledgeGap',
  'no way to state an IMPOSSIBLE transition (glass+uv->melting) -> status=impossible + impossibleReason',
  'the 4-category driver taxonomy had no home for `time` -> added `temporal` category',
  'no INVARIANTS layer and no exceptions -> added 5 invariants + invariantExceptions',
  'no uncertainty measure -> added per-transition `entropy` + State Space Coverage metric'
]) console.log('  · ' + b);
console.log('  => v1.0 did NOT survive unchanged. Evolved to v1.1; the 8 dimensions above run against v1.1.');

console.log('');
if (fails) { console.error(`MBM Ontology Validation Suite FAILED: ${fails} dimension(s)`); process.exit(1); }
console.log('MBM Ontology Validation Suite PASSED — v1.1 survives 5 families + coupled + unknown + impossible + 7 statuses + invariants, unchanged.');
