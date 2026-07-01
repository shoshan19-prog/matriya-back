/**
 * MBM Stage C.4 — Experiment Planner.
 *
 * C.4's job is NOT "pick the best experiment". It is: **build an optimal research
 * portfolio under constraints** (budget of cost & time). It consumes C.3's valued
 * candidates and returns a plan — which experiments, in what order, the total
 * expected knowledge gain, which competing mechanisms get decided, and (crucially)
 * which knowledge gaps REMAIN after the whole plan runs.
 *
 * Diagnosis (C.2) → Valuation (C.3) → **Planning (C.4)**. C.4 still does not
 * decide to run anything — it recommends a plan; the go/no-go stays with the human
 * (Decision Boundary).
 *
 * The one idea that makes this more than "sort by ΔMRI and take the top N":
 * **ΔMRI is NOT additive.** Two experiments on the same transition don't stack;
 * two experiments on different links interact through the weakest-link product and
 * the coverage/validity factors. So the planner never sums standalone gains — it
 * re-simulates the model with the already-selected experiments applied and takes
 * each candidate's *marginal* gain in that context (a submodular greedy under
 * budget; greedy is a documented approximation to the NP-hard knapsack).
 *
 * Each planned experiment is a PREDICTION, not a fact: it carries predictedDeltaMRI
 * with observedDeltaMRI/calibrationError left null, ready for the Prediction
 * Calibration Engine (roadmap) to fill after the experiment actually runs. That is
 * the seed of real Meta-Learning — the model learning whether its own forecasts
 * are optimistic, pessimistic, or well-calibrated.
 *
 * Guardrail: the plan is optimised on ΔMRI *reduction*, never on an absolute-MRI
 * threshold. MRI stays a summary metric; the plan reports the decomposition.
 */
import { candidatesFor, applyCandidate } from './mbm-info-gain.mjs';
import { attributeUncertainty } from './mbm-uncertainty.mjs';
import { generatePaths } from './mbm-alt-paths.mjs';

const round = (x) => Number(x.toFixed(4));

/**
 * @param {object} doc  MBM document
 * @param {string[]} ids  the path (ordered transition ids)
 * @param {{maxCost?:number, maxTime?:number}} budget  sequential-execution budget
 * @returns a research plan (portfolio + expected gain + remaining gaps)
 */
export function planExperiments(doc, ids, { maxCost = Infinity, maxTime = Infinity } = {}) {
  const before = attributeUncertainty(doc, ids);
  const byId = Object.fromEntries((doc.transitions || []).map((t) => [t.id, t]));
  const from = byId[ids[0]].fromState;
  const to = byId[ids[ids.length - 1]].toState;

  const applyAll = (d, cands) => cands.reduce((acc, c) => applyCandidate(acc, c), d);
  const mriOf = (cands) => attributeUncertainty(applyAll(doc, cands), ids).mri;

  // Order a candidate set by MARGINAL efficiency (marginal ΔMRI ÷ cost×time given
  // what's already chosen), optionally under a sequential cost/time budget.
  const greedyOrder = (pool, cost = Infinity, time = Infinity) => {
    const rest = [...pool];
    const chosen = [];
    let cSpent = 0;
    let tSpent = 0;
    let mri = before.mri;
    while (rest.length) {
      let best = null;
      for (const c of rest) {
        if (cSpent + c.cost > cost || tSpent + c.time > time) continue;
        const marginal = mriOf([...chosen, c]) - mri;
        if (marginal <= 1e-6) continue; // adds no information given what's chosen
        const eff = marginal / (c.cost * c.time);
        if (!best || eff > best.eff) best = { c, marginal, eff };
      }
      if (!best) break;
      chosen.push(best.c);
      rest.splice(rest.indexOf(best.c), 1);
      mri = round(mri + best.marginal);
      cSpent += best.c.cost;
      tSpent += best.c.time;
    }
    return chosen;
  };

  // 1) budget-constrained greedy selection.
  let selected = greedyOrder(candidatesFor(doc, ids), maxCost, maxTime);
  // 2) prune pass — drop any experiment whose contribution GIVEN THE OTHERS is ~0
  //    (efficiency-greedy can fund a partially-redundant experiment, e.g. observe
  //    then instrument on the same step, reaching a state instrument alone reaches).
  let pruned = true;
  while (pruned && selected.length) {
    pruned = false;
    const full = mriOf(selected);
    for (let i = 0; i < selected.length; i++) {
      const without = mriOf(selected.filter((_, j) => j !== i));
      if (full - without <= 1e-6) { selected.splice(i, 1); pruned = true; break; }
    }
  }
  // 3) re-derive the execution order + honest marginals over the pruned set.
  selected = greedyOrder(selected);

  const portfolio = [];
  let workDoc = doc;
  let mri = before.mri;
  let spentCost = 0;
  let spentTime = 0;
  for (const c of selected) {
    const next = attributeUncertainty(applyCandidate(workDoc, c), ids);
    const marginal = round(next.mri - mri);
    workDoc = applyCandidate(workDoc, c);
    mri = round(mri + marginal);
    spentCost += c.cost;
    spentTime += c.time;
    portfolio.push({
      step: portfolio.length + 1,
      id: c.id,
      experimentType: c.experimentType,
      target: c.target,
      instrument: c.instrument,
      projects: c.projects,
      cost: c.cost,
      time: c.time,
      // a PREDICTION awaiting observation (Calibration Engine, roadmap):
      predictedDeltaMRI: marginal,
      observedDeltaMRI: null,
      calibrationError: null,
      attacks: next.dominant
    });
  }

  const after = attributeUncertainty(workDoc, ids);
  const altsBefore = generatePaths(doc, from, to);
  const altsAfter = generatePaths(workDoc, from, to);

  // Remaining gaps: read the FINAL (post-plan) model — which steps are still
  // unvalidated, and which still lack instrument evidence.
  const finalTx = Object.fromEntries((workDoc.transitions || []).map((t) => [t.id, t]));
  const remainingGaps = {
    dominantAfter: after.dominant,
    unvalidatedSteps: ids.filter((id) => ['hypothesized', 'predicted'].includes(finalTx[id].status)),
    stepsWithoutInstrument: ids.filter((id) => !(finalTx[id].evidence || []).some((e) => ['tga', 'dsc', 'ftir', 'xrd', 'sem', 'uv_vis'].includes((e.documentType || '').toLowerCase())))
  };

  return {
    ids,
    budget: { maxCost, maxTime },
    baseline: { mri: before.mri, dominant: before.dominant },
    portfolio,
    spent: { cost: spentCost, time: spentTime },
    expected: {
      // TRUE portfolio gain by re-simulation — NOT the sum of standalone gains.
      deltaMRI: round(after.mri - before.mri),
      mriAfter: after.mri,
      // knowledge proxy: fraction of the MRI shortfall the plan closes.
      knowledgeClosed: round((after.mri - before.mri) / Math.max(1e-9, 1 - before.mri)),
      competingBefore: altsBefore.length,
      competingAfter: altsAfter.length
    },
    remainingGaps
  };
}

// --- direct run: demo + self-consistency ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __dir = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(__dir, '..', 'docs', 'material-state', 'mbm-stress-fixtures.json'), 'utf8'));

  let fails = 0;
  const assert = (ok, msg) => { if (!ok) { console.log('  ✗ ' + msg); fails++; } };

  const path = ['app_xl1', 'app_xl2'];
  const show = (title, plan) => {
    console.log(title);
    console.log(`  budget: cost≤${plan.budget.maxCost}, time≤${plan.budget.maxTime}  |  baseline MRI=${plan.baseline.mri} (dominant ${plan.baseline.dominant})`);
    plan.portfolio.forEach((p) => console.log(`   ${p.step}. [${p.experimentType}] ${p.id} — ${p.projects}  (predicted ΔMRI +${p.predictedDeltaMRI}; cost×time ${p.cost}×${p.time})`));
    console.log(`  spent: cost=${plan.spent.cost}, time=${plan.spent.time}  →  MRI ${plan.baseline.mri} → ${plan.expected.mriAfter}  (portfolio ΔMRI +${plan.expected.deltaMRI}, closes ${(plan.expected.knowledgeClosed * 100).toFixed(0)}% of the gap)`);
    console.log(`  remaining gaps: dominant=${plan.remainingGaps.dominantAfter}; unvalidated=[${plan.remainingGaps.unvalidatedSteps.join(', ') || 'none'}]; no-instrument=[${plan.remainingGaps.stepsWithoutInstrument.join(', ') || 'none'}]\n`);
  };

  console.log('MBM Experiment Planner — optimal research portfolio under a budget (C.4 plans; the human decides)\n');
  const tight = planExperiments(doc, path, { maxCost: 2, maxTime: 3 });
  const loose = planExperiments(doc, path, { maxCost: 10, maxTime: 20 });
  show('TIGHT budget (room for one experiment):', tight);
  show('LOOSE budget (fund the program):', loose);

  // --- self-consistency -----------------------------------------------------
  // budget respected
  assert(tight.spent.cost <= 2 && tight.spent.time <= 3, 'tight plan respects the cost & time budget');
  assert(loose.spent.cost <= 10 && loose.spent.time <= 20, 'loose plan respects the cost & time budget');
  // tight budget funds exactly one experiment; it is the highest-value one
  assert(tight.portfolio.length === 1, `tight budget funds a single experiment (got ${tight.portfolio.length})`);
  // more budget never buys less knowledge (monotone in budget)
  assert(loose.expected.deltaMRI >= tight.expected.deltaMRI, 'a larger budget yields ≥ knowledge gain (monotone)');
  // interaction handled: with ample budget the planner does NOT pick BOTH
  // observe:app_xl2 and instrument:app_xl2 (the second is redundant once the first runs)
  const targetsXl2 = loose.portfolio.filter((p) => p.target === 'app_xl2');
  assert(targetsXl2.length === 1, `no double-counting: only one experiment kept on app_xl2 (got ${targetsXl2.length})`);
  // NON-ADDITIVITY proof: portfolio ΔMRI ≠ naive sum of the selected candidates'
  // standalone C.3 gains — the planner re-simulates, it does not sum.
  const { informationGain } = await import('./mbm-info-gain.mjs');
  const standalone = Object.fromEntries(informationGain(doc, path).candidates.map((c) => [c.id, c.deltaMRI]));
  const naiveSum = round(loose.portfolio.reduce((s, p) => s + (standalone[p.id] || 0), 0));
  assert(Math.abs(naiveSum - loose.expected.deltaMRI) > 1e-4, `plan ΔMRI (${loose.expected.deltaMRI}) differs from naive sum of standalone gains (${naiveSum}) — interaction is modelled`);
  console.log(`  [check] naive Σ standalone ΔMRI = ${naiveSum}  vs  true portfolio ΔMRI = ${loose.expected.deltaMRI}  → non-additive, as expected.`);
  // every planned experiment is a prediction awaiting observation (calibration hook)
  assert(loose.portfolio.every((p) => p.predictedDeltaMRI > 0 && p.observedDeltaMRI === null && p.calibrationError === null), 'each experiment is a prediction (observed/calibration pending) — Meta-Learning hook');
  // experiment type is part of the plan
  assert(loose.portfolio.every((p) => typeof p.experimentType === 'string'), 'every planned experiment carries a scientific experiment type');
  // the plan reports what is still open
  assert('dominantAfter' in loose.remainingGaps, 'the plan reports remaining knowledge gaps after execution');

  console.log('');
  if (fails) { console.error(`MBM Experiment Planner FAILED: ${fails} check(s)`); process.exit(1); }
  console.log('MBM Experiment Planner PASSED — budget-constrained portfolio, non-additive gain by re-simulation, predictions for calibration, remaining gaps reported.');
}
