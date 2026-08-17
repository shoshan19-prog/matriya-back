/**
 * Live Fresco<->World comparison — contract wiring proof.
 * Run: node scripts/check-live-comparison.js
 *
 * Proves, on REAL data, that the live comparison path returns all three
 * verdicts with full provenance and that the comparability gate runs BEFORE
 * any value verdict:
 *
 *   REAL case  — Fresco EXP-LEG-044 (recorded legacy burn run, 67 min to the
 *                554°C jump, custom Hobersal ramp, DFT not measured) vs the
 *                verified world source Oguz et al., Fire Safety Journal 153
 *                (2025) 104367 (flat plate, industrial furnace, EN 1363,
 *                critical time 84 min). Conditions are missing/mismatched →
 *                NOT_COMPARABLE (a naive value-compare would emit CONFLICT).
 *   FIXTURES   — condition-MATCHED variants (labeled fixtures) prove the gate
 *                opens to AGREE / CONFLICT only when all conditions align.
 */
import assert from 'node:assert/strict';
import { scientificCompare, RELATION } from '../lib/comparabilityContract.js';

// --- REAL Fresco side: EXP-LEG-044 (MASTER dossier experiment log) ----------
const frescoLeg044 = {
  source_class: 'fresco_internal',
  source_id: 'EXP-LEG-044 (INT-TFX MASTER dossier, experiment log)',
  subject: 'Legacy intumescent run (VINNAPAS EZ 3112 + Exolit AP435)',
  metric: 'time to critical steel temperature',
  value: 67, // minutes: "67 דק׳ עד 374°C ואז קפיצה ל-554°C"
  unit: 'min',
  conditions: {
    // Only what the dossier actually records; everything else genuinely absent.
    fire_curve: 'Hobersal Program3 ramp segments (custom, no standard curve)',
    formulation: 'VINNAPAS EZ 3112 + Exolit AP435 (legacy)',
    metric_definition: null,
    section_factor: null,
    geometry: null,
    surface_location: null,
    sample_size_edge: null,
    arrangement_insulation: null,
    atmosphere: null,
    dft: null, // dossier: "לא נמדד" (not measured)
  },
};

// --- REAL World side: verified primary source (open access, CC BY) ----------
const worldOguz = {
  source_class: 'world_external',
  source_id: 'Oguz2025-FSJ-104367:flat-plate-industrial-cellulosic',
  subject: 'Commercial epoxy intumescent coating (flat plate)',
  metric: 'time to critical steel temperature',
  value: 84, // minutes to 550°C, flat plate, industrial furnace, cellulosic curve
  unit: 'min',
  conditions: {
    metric_definition: 'time to 550C critical steel temperature',
    fire_curve: 'EN 1363 cellulosic (industrial furnace)',
    section_factor: 200,
    geometry: 'flat_plate',
    surface_location: 'exposed_face',
    sample_size_edge: 'industrial_5x200x300mm',
    arrangement_insulation: 'industrial_furnace_standard',
    atmosphere: 'furnace_low_O2_~5pct',
    dft: 5,
    formulation: 'commercial_epoxy (bisphenol-A, TiO2, melamine, fibers)',
  },
};

// 1) REAL vs REAL → NOT_COMPARABLE with full provenance; naive CONFLICT suppressed.
const real = scientificCompare(frescoLeg044, worldOguz);
assert.equal(real.relation, RELATION.NOT_COMPARABLE);
assert.equal(real.value_relation_suppressed, RELATION.CONFLICT, '67 vs 84 min would naively be CONFLICT');
assert.ok(real.comparability.missing.length >= 7, 'the truly-unrecorded Fresco conditions are listed');
assert.ok(real.comparability.mismatched.some((m) => m.key === 'fire_curve'), 'custom ramp vs EN 1363 is a mismatch');
assert.equal(real.provenance.length, 2);
assert.deepEqual(new Set(real.provenance.map((p) => p.source_class)),
  new Set(['fresco_internal', 'world_external']));

// 2) MATCHED FIXTURES → the gate opens only when every condition aligns.
const matched = { ...worldOguz.conditions };
const frescoMatched = {
  source_class: 'fresco_internal', source_id: 'FRESCO-MATCHED-FIXTURE',
  subject: 'matched fixture', metric: 'time to critical steel temperature',
  unit: 'min', value: 84, conditions: { ...matched },
};
const agree = scientificCompare(frescoMatched, { ...worldOguz, source_id: 'WORLD-MATCHED-FIXTURE', value: [80, 90], conditions: { ...matched } });
assert.equal(agree.relation, RELATION.AGREE);
const conflict = scientificCompare({ ...frescoMatched, value: 30 }, { ...worldOguz, source_id: 'WORLD-MATCHED-FIXTURE', value: [80, 90], conditions: { ...matched } });
assert.equal(conflict.relation, RELATION.CONFLICT);

// 3) Gaps and isolation still hold on the live path.
assert.equal(scientificCompare(frescoLeg044, null).relation, RELATION.FRESCO_ONLY);
assert.equal(scientificCompare(null, worldOguz).relation, RELATION.WORLD_ONLY);
assert.throws(() => scientificCompare(worldOguz, worldOguz), /fresco side must be fresco_internal/);

console.log('check-live-comparison: OK');
console.log(`  REAL    ${frescoLeg044.metric}: Fresco=67min [EXP-LEG-044] vs World=84min [Oguz2025] -> ${real.relation} (naive=${real.value_relation_suppressed}; missing=${real.comparability.missing.length}, mismatch=${real.comparability.mismatched.map((m) => m.key).join(',')})`);
console.log(`  MATCHED fixtures -> ${agree.relation} / ${conflict.relation}`);
