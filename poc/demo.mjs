/**
 * Dual-Provenance POC demo board. Run: node poc/demo.mjs
 * Prints the four possible relations, each with full, isolated provenance.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compareClaims, renderComparison } from './dualProvenance.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const world = JSON.parse(readFileSync(join(__dir, 'frozen-external-source.json'), 'utf8'));

const fresco = {
  source_class: 'fresco_internal',
  source_id: 'INT-TFX-001_Results.pdf',
  subject: 'INT-TFX-001 (APP:PER:MEL)',
  metric: 'Expansion Ratio',
  value: 18.5,
  unit: 'ratio (x)',
  context: 'INT-TFX-001 experiment results table (internal Fresco document).',
};

const rows = [
  ['REAL   ', compareClaims(fresco, world)],                                              // 18.5 vs [8,12]
  ['AGREE  ', compareClaims(fresco, { ...world, source_id: 'FROZEN-EXT-REF-AGREE', value: [18, 19] })],
  ['GAP    ', compareClaims(fresco, null)],                                               // FRESCO_ONLY
  ['WORLD  ', compareClaims(null, world)],                                                // WORLD_ONLY
];

console.log('\n  Dual-Provenance comparison board (provenance kept isolated)\n');
for (const [tag, cmp] of rows) {
  console.log(`  ${tag} ${renderComparison(cmp)}`);
  console.log(`          provenance: ${JSON.stringify(cmp.provenance)}\n`);
}
