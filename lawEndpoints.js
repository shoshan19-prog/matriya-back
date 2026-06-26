/**
 * Law graph endpoints — the persistent core of knowledge evolution.
 *
 *   POST /laws                 establish a law from a batch of experiments (K)
 *   POST /laws/check           check a new experiment vs all laws (C); persist;
 *                              if a structured breakdown forms (B) -> create a
 *                              breakdown_event + one decisive experiment (N)
 *   GET  /laws/gaps            open gap recommendations (what to run next)
 *   GET  /laws/:id/history     full lineage: domains, evidence, breakdowns, gaps
 *   POST /laws/:id/evidence    add experiment(s) to a specific law; re-evaluate
 *   GET  /laws                 list laws
 */
import express from 'express';
import { Law, LawDomain, LawEvidence, BreakdownEvent, GapRecommendation, initDb } from './database.js';
import { requireAuth } from './authEndpoints.js';
import { establishLaw, classifyExperiment, evaluateBreakdownFromEvidence } from './lawEngine.js';
import logger from './logger.js';

const router = express.Router();

let dbReady = false;
async function ensureDb(req, res, next) {
  if (!dbReady) {
    try { await initDb(); dbReady = true; }
    catch (e) { return res.status(503).json({ error: 'Database unavailable', detail: e.message }); }
  }
  if (!Law) return res.status(503).json({ error: 'Law store unavailable' });
  next();
}

const lawCoef = (law) => ({ a: law.a, b: law.b, x_key: law.x_key, y_key: law.y_key, tolerance: law.tolerance, noise_std: law.noise_std, features: law.features });

// After new counter-evidence, re-check whether the law has a STRUCTURED breakdown.
async function reevaluate(law) {
  const rows = await LawEvidence.findAll({ where: { law_id: law.id }, order: [['created_at', 'ASC']] });
  const { breakdown, recommendation } = evaluateBreakdownFromEvidence(lawCoef(law), rows.map((r) => r.toJSON()));
  if (!breakdown) return { breakdown: null, recommendation: null };

  // de-dupe: one open breakdown per (feature, threshold±)
  const open = await BreakdownEvent.findAll({ where: { law_id: law.id, status: 'open' } });
  const dup = open.find((e) => e.feature === breakdown.feature && Math.abs(e.threshold - breakdown.threshold) < 1e-6);
  if (dup) return { breakdown: dup.toJSON(), recommendation: null, duplicate: true };

  const event = await BreakdownEvent.create({
    law_id: law.id, feature: breakdown.feature, threshold: breakdown.threshold,
    direction: breakdown.direction, bias: breakdown.bias, consistency: breakdown.consistency,
    failing_ids: breakdown.failing_ids || [],
  });
  await law.update({ status: 'broken', updated_at: new Date() });
  let gap = null;
  if (recommendation) {
    gap = await GapRecommendation.create({
      law_id: law.id, breakdown_event_id: event.id,
      recommended_experiment: recommendation.experiment, rationale: recommendation.rationale,
    });
  }
  logger.info(`Breakdown for law ${law.id} at ${breakdown.feature}>=${breakdown.threshold}; gap ${gap?.id || '—'}`);
  return { breakdown: event.toJSON(), recommendation: gap?.toJSON() || null };
}

// --- establish a law (K) -------------------------------------------------
router.post('/', ensureDb, requireAuth, async (req, res) => {
  const { name, x_key, y_key, features, experiments } = req.body || {};
  if (!x_key || !y_key || !Array.isArray(experiments) || experiments.length < 3)
    return res.status(400).json({ error: 'x_key, y_key and >=3 experiments are required' });
  const feats = Array.isArray(features) && features.length ? features : [x_key];
  const est = establishLaw(experiments, x_key, y_key, feats);
  try {
    const law = await Law.create({ name: name || `${y_key}~${x_key}`, x_key, y_key, a: est.a, b: est.b, tolerance: est.tolerance, noise_std: est.noise_std, features: feats });
    await LawDomain.bulkCreate(est.domains.map((d) => ({ law_id: law.id, ...d })));
    // seed the established (consistent) experiments as supporting evidence
    await LawEvidence.bulkCreate(est.inliers.map((e) => ({ law_id: law.id, experiment: e, kind: 'explained', residual: +(e[y_key] - (est.a * e[x_key] + est.b)).toFixed(3) })));
    res.status(201).json({ law: law.toJSON(), domains: est.domains, established_on: est.inliers.length });
  } catch (e) {
    logger.error(`Law establish failed: ${e.message}`);
    res.status(500).json({ error: 'Could not create law', detail: e.message });
  }
});

// --- check a new experiment (C -> B -> N) --------------------------------
router.post('/check', ensureDb, requireAuth, async (req, res) => {
  const incoming = req.body?.experiments || (req.body?.experiment ? [req.body.experiment] : null);
  if (!incoming) return res.status(400).json({ error: 'experiment or experiments[] required' });

  const laws = await Law.findAll({ where: { status: ['active', 'broken'] } });
  const out = [];
  for (const exp of incoming) {
    const perExp = { experiment: exp, classifications: [], breakdowns: [], recommendations: [] };
    const candidates = laws.filter((l) => exp[l.x_key] !== undefined && exp[l.y_key] !== undefined);
    if (!candidates.length) perExp.classifications.push({ law_id: null, label: 'no_law' });
    for (const law of candidates) {
      const domains = (await LawDomain.findAll({ where: { law_id: law.id } })).map((d) => d.toJSON());
      const c = classifyExperiment(lawCoef(law), domains, exp);
      await LawEvidence.create({ law_id: law.id, experiment: exp, kind: c.label, residual: c.residual });
      perExp.classifications.push({ law_id: law.id, law: law.name, ...c });
      if (c.label === 'contradiction') {
        const r = await reevaluate(law);
        if (r.breakdown && !r.duplicate) perExp.breakdowns.push(r.breakdown);
        if (r.recommendation) perExp.recommendations.push(r.recommendation);
      }
    }
    out.push(perExp);
  }
  res.json({ checked: incoming.length, results: out });
});

// --- open gaps -----------------------------------------------------------
router.get('/gaps', ensureDb, requireAuth, async (req, res) => {
  const gaps = await GapRecommendation.findAll({ where: { status: 'open' }, order: [['created_at', 'DESC']] });
  const enriched = await Promise.all(gaps.map(async (g) => {
    const law = await Law.findByPk(g.law_id);
    const event = g.breakdown_event_id ? await BreakdownEvent.findByPk(g.breakdown_event_id) : null;
    return { ...g.toJSON(), law: law ? { id: law.id, name: law.name, status: law.status } : null, breakdown: event?.toJSON() || null };
  }));
  res.json({ count: enriched.length, gaps: enriched });
});

// --- one law's full history ----------------------------------------------
router.get('/:id/history', ensureDb, requireAuth, async (req, res) => {
  const law = await Law.findByPk(req.params.id);
  if (!law) return res.status(404).json({ error: 'Not found' });
  const [domains, evidence, breakdowns, gaps] = await Promise.all([
    LawDomain.findAll({ where: { law_id: law.id } }),
    LawEvidence.findAll({ where: { law_id: law.id }, order: [['created_at', 'ASC']] }),
    BreakdownEvent.findAll({ where: { law_id: law.id }, order: [['created_at', 'ASC']] }),
    GapRecommendation.findAll({ where: { law_id: law.id }, order: [['created_at', 'ASC']] }),
  ]);
  const ev = evidence.map((e) => e.toJSON());
  res.json({
    law: law.toJSON(),
    domains: domains.map((d) => d.toJSON()),
    evidence_counts: { explained: ev.filter((e) => e.kind === 'explained').length, contradiction: ev.filter((e) => e.kind === 'contradiction').length, out_of_domain: ev.filter((e) => e.kind === 'out_of_domain').length },
    evidence: ev,
    breakdown_events: breakdowns.map((b) => b.toJSON()),
    gap_recommendations: gaps.map((g) => g.toJSON()),
  });
});

// --- add evidence to a specific law --------------------------------------
router.post('/:id/evidence', ensureDb, requireAuth, async (req, res) => {
  const law = await Law.findByPk(req.params.id);
  if (!law) return res.status(404).json({ error: 'Not found' });
  const incoming = req.body?.experiments || (req.body?.experiment ? [req.body.experiment] : null);
  if (!incoming) return res.status(400).json({ error: 'experiment or experiments[] required' });
  const domains = (await LawDomain.findAll({ where: { law_id: law.id } })).map((d) => d.toJSON());
  const classifications = [];
  let sawContradiction = false;
  for (const exp of incoming) {
    const c = classifyExperiment(lawCoef(law), domains, exp);
    await LawEvidence.create({ law_id: law.id, experiment: exp, kind: c.label, residual: c.residual });
    classifications.push({ ...c });
    if (c.label === 'contradiction') sawContradiction = true;
  }
  const r = sawContradiction ? await reevaluate(law) : { breakdown: null, recommendation: null };
  res.json({ law_id: law.id, added: incoming.length, classifications, breakdown: r.breakdown, recommendation: r.recommendation });
});

// --- list ----------------------------------------------------------------
router.get('/', ensureDb, requireAuth, async (req, res) => {
  const laws = await Law.findAll({ order: [['created_at', 'DESC']], limit: 200 });
  res.json(laws.map((l) => l.toJSON()));
});

export { router as lawRouter };
