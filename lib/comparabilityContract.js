/**
 * Scientific Comparability gate — the jump from data comparison to scientific
 * judgment. Two measurements may be compared for AGREE/CONFLICT ONLY when their
 * measurement conditions match. If even ONE critical condition is missing or
 * mismatched, the result is NOT_COMPARABLE — never a (false) CONFLICT.
 *
 * Grounded in a verified primary source:
 *   Oguz, Olsson, Robson, Dam-Johansen, Dreyer,
 *   "Evaluating the impact of testing conditions on intumescent coatings' fire
 *    performance: A comparison of laboratory-scale and industrial-scale
 *    experiments", Fire Safety Journal 153 (2025) 104367,
 *    DOI 10.1016/j.firesaf.2025.104367 (open access, CC BY).
 * That paper shows the SAME coating expanding 4-6x (lab) vs 13-15x (industrial)
 * by test setup alone, and states there is "no established method for
 * correlating results across different setups."
 *
 * Scope (deliberately minimal): pure logic, no web, no API, no multi-agent.
 * Builds on the Dual-Provenance POC (poc/dualProvenance.js).
 */

import { compareClaims, RELATION as BASE_RELATION } from './dualProvenanceContract.js';

/** Base relations + NOT_COMPARABLE. */
export const RELATION = Object.freeze({
  ...BASE_RELATION,
  NOT_COMPARABLE: 'NOT_COMPARABLE',
});

/**
 * The critical comparability conditions. Each MUST be present on both sides and
 * match for a scientific comparison to proceed. Derived from the verified source.
 * (substrate_thickness / heating_rate are contributing, reported but not gating.)
 */
export const CRITICAL_CONDITIONS = Object.freeze([
  { key: 'metric_definition', type: 'categorical', label: 'metric definition (e.g. δ1/δ0)' },
  { key: 'fire_curve', type: 'categorical', label: 'fire curve / heating regime' },
  { key: 'section_factor', type: 'numeric', relTol: 0.05, label: 'section factor (m^-1)' },
  { key: 'geometry', type: 'categorical', label: 'sample geometry' },
  { key: 'surface_location', type: 'categorical', label: 'matched surface location' },
  { key: 'sample_size_edge', type: 'categorical', label: 'sample size / edge restriction' },
  { key: 'arrangement_insulation', type: 'categorical', label: 'arrangement / insulation (thermal boundary)' },
  { key: 'atmosphere', type: 'categorical', label: 'gas atmosphere / O2' },
  { key: 'dft', type: 'numeric', relTol: 0.10, label: 'dry film thickness (mm)' },
  { key: 'formulation', type: 'categorical', label: 'formulation identity' },
]);

const isMissing = (v) => v == null || (typeof v === 'string' && v.trim() === '');

function categoricalMatch(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function numericMatch(a, b, relTol) {
  const x = Number(a);
  const y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  const scale = Math.max(Math.abs(x), Math.abs(y), 1e-9);
  return Math.abs(x - y) / scale <= relTol;
}

/**
 * Assess whether two claims are comparable. Reports every missing / mismatched
 * critical condition — the gate is transparent about WHY it refuses.
 * @returns {{comparable:boolean, missing:Array, mismatched:Array}}
 */
export function assessComparability(frescoClaim, worldClaim) {
  const fc = frescoClaim?.conditions ?? {};
  const wc = worldClaim?.conditions ?? {};
  const missing = [];
  const mismatched = [];

  for (const cond of CRITICAL_CONDITIONS) {
    const fMissing = isMissing(fc[cond.key]);
    const wMissing = isMissing(wc[cond.key]);
    if (fMissing || wMissing) {
      missing.push({
        key: cond.key,
        label: cond.label,
        side: fMissing && wMissing ? 'both' : fMissing ? 'fresco' : 'world',
      });
      continue;
    }
    const ok = cond.type === 'numeric'
      ? numericMatch(fc[cond.key], wc[cond.key], cond.relTol)
      : categoricalMatch(fc[cond.key], wc[cond.key]);
    if (!ok) {
      mismatched.push({ key: cond.key, label: cond.label, fresco: fc[cond.key], world: wc[cond.key] });
    }
  }

  return { comparable: missing.length === 0 && mismatched.length === 0, missing, mismatched };
}

/**
 * Scientific compare: Dual-Provenance isolation + comparability gate.
 *
 *   one side missing            -> FRESCO_ONLY / WORLD_ONLY (a gap; gate N/A)
 *   both present, gate fails     -> NOT_COMPARABLE (+ missing/mismatched list)
 *   both present, gate passes    -> AGREE / CONFLICT (by value overlap)
 */
export function scientificCompare(frescoClaim, worldClaim, opts = {}) {
  // Reuse the Dual-Provenance layer: isolation + gap handling + value overlap.
  const base = compareClaims(frescoClaim, worldClaim, opts);

  // A gap (one side absent) is not a comparability question.
  if (base.relation === RELATION.FRESCO_ONLY || base.relation === RELATION.WORLD_ONLY) {
    return { ...base, comparability: { comparable: false, reason: 'one side absent', missing: [], mismatched: [] } };
  }

  // Both sides present -> the gate decides BEFORE the value verdict is allowed.
  const gate = assessComparability(frescoClaim, worldClaim);
  if (!gate.comparable) {
    return {
      ...base,
      relation: RELATION.NOT_COMPARABLE, // overrides the value-based AGREE/CONFLICT
      value_relation_suppressed: base.relation, // what a naive data-compare WOULD have said
      comparability: gate,
    };
  }

  return { ...base, comparability: gate };
}

/** One-line rendering for the demo board. */
export function renderScientific(cmp) {
  const f = cmp.fresco ? `${JSON.stringify(cmp.fresco.value)}` : '—';
  const w = cmp.world ? `${JSON.stringify(cmp.world.value)}` : '—';
  let tail = '';
  if (cmp.relation === RELATION.NOT_COMPARABLE) {
    const miss = cmp.comparability.missing.map((m) => m.key);
    const mism = cmp.comparability.mismatched.map((m) => m.key);
    const bits = [];
    if (miss.length) bits.push(`missing: ${miss.join(', ')}`);
    if (mism.length) bits.push(`mismatch: ${mism.join(', ')}`);
    tail = `  (naive=${cmp.value_relation_suppressed}; ${bits.join(' | ')})`;
  }
  return `${cmp.metric} | Fresco=${f} vs World=${w} -> ${cmp.relation}${tail}`;
}
