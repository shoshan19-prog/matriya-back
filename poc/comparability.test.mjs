/**
 * Scientific Comparability tests — prove the jump from data comparison to
 * scientific judgment. Run: node --test poc/comparability.test.mjs
 *
 * Acceptance criteria (as set by the reviewer):
 *   - The INT-TFX case (18.5, no recorded conditions) MUST return NOT_COMPARABLE
 *     WITH the list of missing comparability conditions — never CONFLICT.
 *   - Only a case whose conditions match completely may reach AGREE / CONFLICT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scientificCompare, assessComparability, CRITICAL_CONDITIONS, RELATION } from './comparability.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const verifiedWorld = JSON.parse(readFileSync(join(__dir, 'verified-external-source.json'), 'utf8'));

// --- The REAL Fresco claim as it exists TODAY: a value with NO conditions -----
// (The internal INT-TFX-001 document reports 18.5 only — no fire curve, section
//  factor, geometry, DFT, formulation-in-structured-form, etc.)
const frescoIntTfx = {
  source_class: 'fresco_internal',
  source_id: 'INT-TFX-001_Results.pdf',
  subject: 'INT-TFX-001 (APP:PER:MEL)',
  metric: 'Expansion Ratio',
  value: 18.5,
  unit: 'ratio',
  context: 'INT-TFX-001 experiment results table (internal Fresco document).',
  conditions: {}, // <-- nothing recorded. This is the real state.
};

// A pair of fully-specified claims with IDENTICAL conditions (test fixtures,
// not real citations) — used only to prove the gate lets matched cases through.
const matchedConditions = {
  metric_definition: 'delta1/delta0 (expanded/initial thickness, needle depth-caliper)',
  fire_curve: 'EN 1363 (industrial furnace)',
  section_factor: 200,
  geometry: 'flat_plate',
  surface_location: 'exposed_face',
  sample_size_edge: 'industrial_5x200x300mm',
  arrangement_insulation: 'industrial_furnace_standard',
  atmosphere: 'furnace_low_O2_~5pct',
  dft: 5,
  formulation: 'commercial_epoxy (bisphenol-A, TiO2, melamine, fibers)',
};
const frescoMatched = {
  source_class: 'fresco_internal', source_id: 'FRESCO-MATCHED-FIXTURE',
  subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio (delta1/delta0)',
  value: 14, conditions: { ...matchedConditions },
};

test('ACCEPTANCE 1: INT-TFX (18.5, no conditions) vs verified world -> NOT_COMPARABLE + missing list', () => {
  const cmp = scientificCompare(frescoIntTfx, verifiedWorld);

  assert.equal(cmp.relation, RELATION.NOT_COMPARABLE, 'must NOT be CONFLICT');
  // A naive data-compare would have wrongly said CONFLICT (18.5 outside [13,15]).
  assert.equal(cmp.value_relation_suppressed, RELATION.CONFLICT);

  // The list of missing conditions is present and covers every critical condition
  // (Fresco side recorded none of them).
  const missingKeys = cmp.comparability.missing.map((m) => m.key);
  for (const cond of CRITICAL_CONDITIONS) {
    assert.ok(missingKeys.includes(cond.key), `missing must list ${cond.key}`);
  }
  // Provenance still full and isolated.
  assert.equal(cmp.provenance.length, 2);

  console.log('    ACC1 > NOT_COMPARABLE; missing:', missingKeys.join(', '));
});

test('ACCEPTANCE 2a: fully-matched conditions + overlapping values -> AGREE', () => {
  const world = { source_class: 'world_external', source_id: 'WORLD-MATCHED-FIXTURE',
    subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio', value: [13, 15],
    conditions: { ...matchedConditions } };
  const cmp = scientificCompare(frescoMatched, world);
  assert.equal(cmp.relation, RELATION.AGREE);
  assert.equal(cmp.comparability.comparable, true);
});

test('ACCEPTANCE 2b: fully-matched conditions + non-overlapping values -> CONFLICT', () => {
  const world = { source_class: 'world_external', source_id: 'WORLD-MATCHED-FIXTURE',
    subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio', value: [4, 6],
    conditions: { ...matchedConditions } };
  const cmp = scientificCompare({ ...frescoMatched, value: 14 }, world);
  assert.equal(cmp.relation, RELATION.CONFLICT); // only reachable because conditions match
  assert.equal(cmp.comparability.comparable, true);
});

test('even ONE missing critical condition -> NOT_COMPARABLE', () => {
  const world = { source_class: 'world_external', source_id: 'WORLD-MATCHED-FIXTURE',
    subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio', value: [13, 15],
    conditions: { ...matchedConditions } };
  const worldMinusOne = { ...world, conditions: { ...matchedConditions } };
  delete worldMinusOne.conditions.atmosphere; // drop exactly one
  const cmp = scientificCompare(frescoMatched, worldMinusOne);
  assert.equal(cmp.relation, RELATION.NOT_COMPARABLE);
  assert.deepEqual(cmp.comparability.missing.map((m) => m.key), ['atmosphere']);
});

test('mismatched formulation (all else matched) -> NOT_COMPARABLE', () => {
  const world = { source_class: 'world_external', source_id: 'WORLD-MISMATCH',
    subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio', value: [13, 15],
    conditions: { ...matchedConditions, formulation: 'APP:PER:MEL 3:1:1' } };
  const cmp = scientificCompare(frescoMatched, world);
  assert.equal(cmp.relation, RELATION.NOT_COMPARABLE);
  assert.equal(cmp.comparability.mismatched[0].key, 'formulation');
});

test('mismatched numeric condition beyond tolerance (section_factor) -> NOT_COMPARABLE', () => {
  const world = { source_class: 'world_external', source_id: 'WORLD-SF',
    subject: 'matched fixture', metric: 'Expansion Ratio', unit: 'ratio', value: [13, 15],
    conditions: { ...matchedConditions, section_factor: 333 } };
  const cmp = scientificCompare(frescoMatched, world);
  assert.equal(cmp.relation, RELATION.NOT_COMPARABLE);
  assert.equal(cmp.comparability.mismatched[0].key, 'section_factor');
});

test('gap still works: world side absent -> WORLD_ONLY (gate N/A)', () => {
  const cmp = scientificCompare(null, verifiedWorld);
  assert.equal(cmp.relation, RELATION.WORLD_ONLY);
});

test('isolation still enforced: fresco claim in world slot is refused', () => {
  assert.throws(() => scientificCompare(frescoMatched, frescoMatched), /world side must be world_external/);
});

test('assessComparability is transparent: reports the exact missing keys', () => {
  const gate = assessComparability(frescoIntTfx, verifiedWorld);
  assert.equal(gate.comparable, false);
  assert.equal(gate.missing.length, CRITICAL_CONDITIONS.length);
});
