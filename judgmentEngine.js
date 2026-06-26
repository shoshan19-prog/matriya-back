/**
 * Validated Judgment — engine (pure, zero-dependency).
 *
 * The atomic unit of industrial intelligence is NOT an experiment. It is a
 * Validated Judgment: an expert decision under uncertainty, with its rejected
 * alternatives and a FALSIFIABLE prediction, that reality grades over time.
 *
 * This module is the canonical server-side copy of the MVP engine
 * (mvp/validated-judgment/engine.mjs in matriya-front-). It is intentionally
 * free of DB/Express coupling so it stays unit-testable.
 */

export const SEVERITY = ['none', 'minimal', 'moderate', 'severe'];
const DAY = 86_400_000;

/** Reject any judgment that is not falsifiable. This rule is the whole asset. */
export function validateJudgment(j) {
  const errors = [];
  const req = (path, v) => { if (v === undefined || v === null || v === '') errors.push(`missing: ${path}`); };

  req('domain', j.domain);
  req('decided_by', j.decided_by);
  req('context.substrate', j.context?.substrate);
  req('context.conditions', j.context?.conditions);
  req('problem', j.problem);
  req('decision', j.decision);
  req('rationale', j.rationale);

  if (!(j.confidence > 0 && j.confidence <= 1)) errors.push('confidence must be in (0, 1]');

  if (!Array.isArray(j.alternatives_considered) || j.alternatives_considered.length === 0)
    errors.push('alternatives_considered: at least one rejected option is required (the why-not is the asset)');
  else j.alternatives_considered.forEach((a, i) => {
    if (!a?.option) errors.push(`alternatives_considered[${i}].option missing`);
    if (!a?.why_rejected) errors.push(`alternatives_considered[${i}].why_rejected missing`);
  });

  if (!Array.isArray(j.predictions) || j.predictions.length === 0) {
    errors.push('predictions: at least one FALSIFIABLE prediction is required — a judgment with no testable prediction is rejected at capture');
  } else {
    j.predictions.forEach((p, i) => {
      req(`predictions[${i}].metric`, p?.metric);
      if (!(p?.horizon_days > 0)) errors.push(`predictions[${i}].horizon_days must be > 0 (when will reality answer?)`);
      if (p?.kind === 'numeric') {
        if (!['<', '<=', '>', '>=', '=='].includes(p.comparator)) errors.push(`predictions[${i}].comparator invalid`);
        if (typeof p.target !== 'number') errors.push(`predictions[${i}].target must be a number`);
      } else if (p?.kind === 'qualitative') {
        if (!SEVERITY.includes(p.expected_max)) errors.push(`predictions[${i}].expected_max must be one of ${SEVERITY.join('|')}`);
      } else {
        errors.push(`predictions[${i}].kind must be 'numeric' or 'qualitative'`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

/** One pending follow-up per prediction, due at decided_at + horizon. */
export function computeFollowups(j, decidedAtISO) {
  const decided = Date.parse(decidedAtISO || j.decided_at || new Date().toISOString());
  return (j.predictions || []).map((p, idx) => ({
    prediction_idx: idx,
    metric: p.metric,
    due_at: new Date(decided + p.horizon_days * DAY).toISOString().slice(0, 10),
    status: 'pending',
  }));
}

const GRADE_VALUE = { matched: 1, partial: 0.5, missed: 0 };

export function gradePrediction(p, observed) {
  if (p.kind === 'numeric') {
    const v = Number(observed.value), t = p.target;
    const sat = { '<': v < t, '<=': v <= t, '>': v > t, '>=': v >= t, '==': v === t }[p.comparator];
    if (sat) return 'matched';
    const band = p.partial_band ?? Math.max(Math.abs(t) * 0.2, 1);
    const near = (p.comparator === '<' || p.comparator === '<=') ? v <= t + band
               : (p.comparator === '>' || p.comparator === '>=') ? v >= t - band
               : Math.abs(v - t) <= band;
    return near ? 'partial' : 'missed';
  }
  const oi = SEVERITY.indexOf(observed.value), ei = SEVERITY.indexOf(p.expected_max);
  if (oi === -1) return 'missed';
  if (oi <= ei) return 'matched';
  if (oi === ei + 1) return 'partial';
  return 'missed';
}

/** Outcome (how right) + Brier (how honest the confidence was). */
export function scoreJudgment(j) {
  const graded = (j.observations || []).map(o => {
    const p = j.predictions[o.prediction_idx];
    const grade = gradePrediction(p, o);
    return {
      prediction_idx: o.prediction_idx,
      metric: p.metric,
      horizon_days: p.horizon_days,
      observed: o.value,
      expected: p.kind === 'numeric' ? `${p.comparator} ${p.target}` : `<= ${p.expected_max}`,
      grade,
      value: GRADE_VALUE[grade],
    };
  });
  const n = graded.length;
  const outcome = n ? graded.reduce((s, g) => s + g.value, 0) / n : null;
  const brier = n ? graded.reduce((s, g) => s + (j.confidence - g.value) ** 2, 0) / n : null;
  const verdict = outcome === null ? 'open' : outcome >= 0.8 ? 'CORRECT' : outcome >= 0.5 ? 'PARTIALLY_CORRECT' : 'INCORRECT';
  const calibration = brier === null ? 'n/a'
    : brier <= 0.1 ? 'well-calibrated'
    : (outcome < j.confidence ? 'over-confident' : 'under-confident');
  return { closed: n, total: (j.predictions || []).length, outcome, brier, verdict, calibration, graded };
}

/** Aggregate calibration for one expert across many closed judgments. */
export function calibrationForExpert(judgments) {
  const closed = judgments.filter(j => (j.observations || []).length > 0).map(j => ({ j, s: scoreJudgment(j) }));
  if (!closed.length) return { expert: judgments[0]?.decided_by ?? null, judgments: 0, closed: 0, mean_outcome: null, mean_brier: null, calibration: 'n/a' };
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mean_outcome = mean(closed.map(c => c.s.outcome));
  const mean_brier = mean(closed.map(c => c.s.brier));
  const mean_conf = mean(closed.map(c => c.j.confidence));
  return {
    expert: judgments[0]?.decided_by ?? null,
    judgments: judgments.length,
    closed: closed.length,
    mean_confidence: mean_conf,
    mean_outcome,
    mean_brier,
    calibration: mean_brier <= 0.1 ? 'well-calibrated' : (mean_outcome < mean_conf ? 'over-confident' : 'under-confident'),
  };
}
