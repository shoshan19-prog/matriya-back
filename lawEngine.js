/**
 * Law Evolution Engine — pure core (zero dependencies, DB-free, testable).
 *
 * The atomic unit of knowledge is the LAW: a relation + a domain of validity +
 * evidence for/against + a breakdown history. New knowledge is proposed ONLY
 * after a structured breakdown — never on a single anomaly. This mirrors
 * MATRIYA's gate: K (known law) -> C (check evidence) -> B (structured
 * breakdown) -> N (one decisive experiment) -> L (validate, later).
 *
 * Canonical sibling of the frontend MVP (mvp/knowledge-gap/engine.mjs).
 */

const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const std = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) ** 2))); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

/** Linear law y ≈ a·x + b. */
export function fitLinear(points, xKey, yKey) {
  const n = points.length;
  const sx = points.reduce((s, p) => s + p[xKey], 0);
  const sy = points.reduce((s, p) => s + p[yKey], 0);
  const sxx = points.reduce((s, p) => s + p[xKey] ** 2, 0);
  const sxy = points.reduce((s, p) => s + p[xKey] * p[yKey], 0);
  const denom = n * sxx - sx * sx || 1e-9;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return { a, b };
}

export const predict = (law, x) => law.a * x + law.b;

/**
 * K: establish a law on its largest self-consistent region; derive its domain.
 *
 * IMPORTANT: the domain of validity restricts only the law's INPUT variable
 * (x_key) plus any covariates the modeller EXPLICITLY scopes (domainFeatures).
 * The remaining `features` are dimensions the law is implicitly assumed
 * invariant over — and a structured failure along one of those is exactly a
 * breakdown (the birth of a new boundary). If we auto-restricted the domain on
 * every feature, the law would silently excuse itself from the very evidence
 * that should contradict it, and no knowledge would ever evolve.
 */
export function establishLaw(experiments, xKey, yKey, features, tol0 = 4, domainFeatures = null) {
  let best = { inliers: [], coef: null };
  for (let i = 0; i < experiments.length; i++) {
    for (let j = i + 1; j < experiments.length; j++) {
      if (experiments[i][xKey] === experiments[j][xKey]) continue;
      const coef = fitLinear([experiments[i], experiments[j]], xKey, yKey);
      const inliers = experiments.filter((e) => Math.abs(e[yKey] - predict(coef, e[xKey])) <= tol0);
      if (inliers.length > best.inliers.length) best = { inliers, coef };
    }
  }
  const coef = fitLinear(best.inliers, xKey, yKey);
  const residuals = best.inliers.map((e) => e[yKey] - predict(coef, e[xKey]));
  const noise_std = std(residuals) || 1;
  const tolerance = Math.max(2 * noise_std, 2);
  const domFeats = domainFeatures || [xKey];   // default: scope ONLY the input variable
  const domains = domFeats.map((f) => ({
    feature: f,
    min_value: Math.min(...best.inliers.map((e) => e[f])),
    max_value: Math.max(...best.inliers.map((e) => e[f])),
  }));
  return { a: coef.a, b: coef.b, x_key: xKey, y_key: yKey, features, tolerance, noise_std, inliers: best.inliers, domains };
}

export function inDomain(domains, exp) {
  return domains.every((d) => exp[d.feature] === undefined || (exp[d.feature] >= d.min_value && exp[d.feature] <= d.max_value));
}

/** C: classify one experiment against one law. */
export function classifyExperiment(law, domains, exp) {
  const residual = +(exp[law.y_key] - predict(law, exp[law.x_key])).toFixed(3);
  const within = inDomain(domains, exp);
  let label;
  if (!within) label = 'out_of_domain';        // not this law's claim
  else if (Math.abs(residual) <= law.tolerance) label = 'explained';
  else label = 'contradiction';                 // inside the domain the law claims, yet it fails
  return { label, residual, within };
}

/** B: is the accumulated counter-evidence a STRUCTURED breakdown, not noise? */
export function detectBreakdown(scored, features, tolerance, noise_std) {
  let best = null;
  for (const f of features) {
    const xs = [...new Set(scored.map((e) => e[f]))].sort((p, q) => p - q);
    for (let i = 1; i < xs.length; i++) {
      const t = (xs[i - 1] + xs[i]) / 2;
      const low = scored.filter((e) => e[f] < t), high = scored.filter((e) => e[f] >= t);
      if (low.length < 3 || high.length < 3) continue;
      const lowExplained = low.filter((e) => Math.abs(e.residual) <= tolerance).length / low.length;
      const rHigh = high.map((e) => e.residual);
      const sign = Math.sign(median(rHigh)) || 1;
      const consistency = high.filter((e) => Math.sign(e.residual) === sign).length / high.length;
      const bias = Math.abs(mean(rHigh));
      const structured = lowExplained >= 0.8 && consistency >= 0.8 && bias > Math.max(3 * noise_std, tolerance);
      const score = structured ? bias * consistency : 0;
      if (score > 0 && (!best || score > best.score)) best = {
        feature: f, threshold: t, bias: +bias.toFixed(2), consistency: +consistency.toFixed(2), score,
        direction: sign < 0 ? 'over-predicts (actual lower than law)' : 'under-predicts (actual higher than law)',
        failing_ids: high.filter((e) => Math.abs(e.residual) > tolerance).map((e) => e.id).filter(Boolean),
      };
    }
  }
  return best;
}

/** N: the single smallest deciding experiment (max information gain). */
export function proposeExperiment(scored, law, breakdown) {
  if (!breakdown) return null;
  const f = breakdown.feature;
  const vals = [...new Set(scored.map((e) => e[f]))].sort((p, q) => p - q);
  let straddle = null;
  for (let i = 1; i < vals.length; i++) if (vals[i - 1] < breakdown.threshold && vals[i] >= breakdown.threshold) straddle = { lo: vals[i - 1], hi: vals[i] };
  if (!straddle) straddle = { lo: breakdown.threshold, hi: breakdown.threshold };
  const at = +((straddle.lo + straddle.hi) / 2).toFixed(2);
  const breakoutEstimate = mean(scored.filter((e) => e[f] >= breakdown.threshold).map((e) => e[law.y_key]));
  const xMax = Math.max(...scored.map((e) => e[law.x_key]));
  return {
    experiment: { [f]: at, [law.x_key]: xMax },
    rationale: `Unexplored gap in ${f} ∈ (${straddle.lo}, ${straddle.hi}). At ${law.x_key}=${xMax} the law predicts ${law.y_key}≈${predict(law, xMax).toFixed(0)} while the breakdown region averages ≈${breakoutEstimate.toFixed(0)} — maximal disagreement; one experiment here settles whether the boundary is real.`,
  };
}

/** Re-evaluate a law against its full evidence ledger (for the persistence layer). */
export function evaluateBreakdownFromEvidence(law, evidenceRows) {
  const scored = evidenceRows.map((row) => {
    const exp = row.experiment || row;
    return { ...exp, id: exp.id ?? row.id, residual: +(exp[law.y_key] - predict(law, exp[law.x_key])).toFixed(3) };
  });
  const bd = detectBreakdown(scored, law.features || [law.x_key], law.tolerance, law.noise_std);
  const recommendation = bd ? proposeExperiment(scored, law, bd) : null;
  return { breakdown: bd, recommendation, scored };
}
