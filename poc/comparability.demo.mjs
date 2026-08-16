/**
 * Scientific Comparability demo board. Run: node poc/comparability.demo.mjs
 * Shows that the INT-TFX case is refused (NOT_COMPARABLE) while a fully-matched
 * case is allowed through to AGREE / CONFLICT.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scientificCompare, renderScientific } from './comparability.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const world = JSON.parse(readFileSync(join(__dir, 'verified-external-source.json'), 'utf8'));

const frescoIntTfx = {
  source_class: 'fresco_internal', source_id: 'INT-TFX-001_Results.pdf',
  subject: 'INT-TFX-001 (APP:PER:MEL)', metric: 'Expansion Ratio', value: 18.5, unit: 'ratio',
  conditions: {}, // real state: no conditions recorded
};

const cond = {
  metric_definition: 'delta1/delta0 (needle depth-caliper)', fire_curve: 'EN 1363 (industrial furnace)',
  section_factor: 200, geometry: 'flat_plate', surface_location: 'exposed_face',
  sample_size_edge: 'industrial_5x200x300mm', arrangement_insulation: 'industrial_furnace_standard',
  atmosphere: 'furnace_low_O2_~5pct', dft: 5, formulation: 'commercial_epoxy (bisphenol-A, TiO2, melamine, fibers)',
};
const frescoMatched = { source_class: 'fresco_internal', source_id: 'FRESCO-MATCHED', subject: 'matched',
  metric: 'Expansion Ratio', value: 14, unit: 'ratio', conditions: { ...cond } };
const worldMatchedAgree = { ...world, source_id: 'WORLD-MATCHED', value: [13, 15], conditions: { ...cond } };
const worldMatchedConflict = { ...world, source_id: 'WORLD-MATCHED', value: [4, 6], conditions: { ...cond } };

console.log('\n  Scientific comparability board (gate BEFORE value verdict)\n');
console.log('  INT-TFX  ', renderScientific(scientificCompare(frescoIntTfx, world)));
console.log('  MATCHED  ', renderScientific(scientificCompare(frescoMatched, worldMatchedAgree)));
console.log('  MATCHED  ', renderScientific(scientificCompare(frescoMatched, worldMatchedConflict)));
console.log('');
