/**
 * Phase A — shadow kernel.
 *
 * Calls the existing deterministic helpers in kernelV16.js and produces a
 * JSON-serialisable verdict. The verdict is stored in
 * decision_audit_log.details.shadow_decision so we can compare what the
 * kernel WOULD have decided against what the live (non-enforcing) path
 * actually returned.
 *
 * Never throws. Never blocks. Never mutates inputs.
 */

import {
  evaluateBreakdown,
  evaluateFailSafe,
  validateDataAnchors,
  checkExtrapolationRule,
  checkMethodologyFlags,
  validateLGate,
  KERNEL_V16_VERSION
} from '../kernelV16.js';

/**
 * @param {object} input
 * @param {string|null} [input.stage]              - 'K' | 'C' | 'B' | 'N' | 'L' | null
 * @param {object|null} [input.kernel_signals]
 * @param {object|null} [input.data_anchors]
 * @param {object|null} [input.methodology_flags]
 * @param {object|null} [input.l_validation]
 * @param {number}      [input.evidence_count]     - chunks/snippets/files used as evidence
 * @returns {{
 *   kernel_version: string,
 *   would_block: boolean,
 *   decision: 'shadow_block' | 'shadow_allow',
 *   blockers: Array<{ code: string, source: string, reasons?: string[] }>,
 *   inputs_summary: object,
 *   computed_in_ms: number,
 *   note: string
 * }}
 */
export function computeShadowVerdict(input = {}) {
  const t0 = Date.now();
  const stage = input.stage || null;
  const kernelSignals = input.kernel_signals || null;
  const dataAnchors = input.data_anchors || null;
  const methodologyFlags = input.methodology_flags || null;
  const lValidation = input.l_validation || null;
  const evidenceCount = Number.isFinite(input.evidence_count) ? Number(input.evidence_count) : 0;

  const blockers = [];

  // 1. Fail-safe (insufficient data / variables not distinguishable)
  try {
    const fs = evaluateFailSafe(kernelSignals);
    if (fs && fs.ok === false) {
      blockers.push({ code: fs.code || 'FAIL_SAFE', source: 'fail_safe' });
    }
  } catch (_) { /* never throw */ }

  // 2. Breakdown (only when signals supplied)
  try {
    if (kernelSignals && Object.keys(kernelSignals).length > 0) {
      const br = evaluateBreakdown(kernelSignals);
      if (br && br.breakdown) {
        blockers.push({ code: 'BREAKDOWN', source: 'breakdown', reasons: br.reasons });
      }
    }
  } catch (_) { /* never throw */ }

  // 3. Data anchors
  try {
    const an = validateDataAnchors(dataAnchors);
    if (an && an.ok === false) {
      blockers.push({ code: 'INVALID_ANCHOR', source: 'anchors' });
    }
  } catch (_) { /* never throw */ }

  // 4. Extrapolation
  try {
    const ex = checkExtrapolationRule(kernelSignals);
    if (ex && ex.ok === false) {
      blockers.push({ code: 'EXTRAPOLATION_BLOCKED', source: 'extrapolation' });
    }
  } catch (_) { /* never throw */ }

  // 5. Methodology trip
  try {
    const me = checkMethodologyFlags(methodologyFlags);
    if (me && me.trip) {
      blockers.push({ code: 'METHODOLOGY_TRIP', source: 'methodology', reasons: me.reasons });
    }
  } catch (_) { /* never throw */ }

  // 6. L-gate (only when entering stage L)
  try {
    if (stage === 'L') {
      const lg = validateLGate(lValidation);
      if (lg && lg.ok === false) {
        blockers.push({ code: lg.reason || 'L_VALIDATION_FAILED', source: 'l_gate' });
      }
    }
  } catch (_) { /* never throw */ }

  // 7. Evidence presence (cheap structural check)
  if (evidenceCount <= 0) {
    blockers.push({ code: 'NO_EVIDENCE', source: 'evidence_count' });
  }

  const wouldBlock = blockers.length > 0;
  return {
    kernel_version: KERNEL_V16_VERSION,
    would_block: wouldBlock,
    decision: wouldBlock ? 'shadow_block' : 'shadow_allow',
    blockers,
    inputs_summary: {
      stage,
      had_kernel_signals: !!kernelSignals,
      had_data_anchors: !!dataAnchors,
      had_methodology_flags: !!methodologyFlags,
      had_l_validation: !!lValidation,
      evidence_count: evidenceCount
    },
    computed_in_ms: Date.now() - t0,
    note: 'shadow_only_no_enforcement'
  };
}

/**
 * Convenience: merge a shadow_decision into an existing details object
 * without overwriting the caller's keys. Returns a new object.
 */
export function mergeShadowIntoDetails(details, shadow) {
  const base = details && typeof details === 'object' ? details : {};
  if (!shadow || typeof shadow !== 'object') return base;
  return { ...base, shadow_decision: shadow };
}
