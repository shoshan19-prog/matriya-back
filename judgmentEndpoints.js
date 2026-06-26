/**
 * Validated Judgment endpoints.
 *
 *   POST /judgments                      capture (422 if not falsifiable) -> schedules follow-ups
 *   GET  /judgments?expert=&status=      list
 *   GET  /judgments/:id                  one, with live score
 *   POST /judgments/:id/observations     record reality's answer -> regrade -> maybe close
 *   GET  /judgments/calibration?expert=  per-expert calibration record
 *   GET  /judgments/followups/due?asOf=  follow-ups currently due
 */
import express from 'express';
import { Op } from 'sequelize';
import { Judgment, initDb } from './database.js';
import { getCurrentUser, requireAuth } from './authEndpoints.js';
import { validateJudgment, computeFollowups, scoreJudgment, calibrationForExpert } from './judgmentEngine.js';
import logger from './logger.js';

const router = express.Router();

let dbReady = false;
async function ensureDb(req, res, next) {
  if (!dbReady) {
    try { await initDb(); dbReady = true; }
    catch (e) { return res.status(503).json({ error: 'Database unavailable', detail: e.message }); }
  }
  if (!Judgment) return res.status(503).json({ error: 'Judgment store unavailable' });
  next();
}

const withScore = (row) => { const j = row.toJSON ? row.toJSON() : row; return { ...j, score: scoreJudgment(j) }; };

// --- capture -------------------------------------------------------------
router.post('/', ensureDb, requireAuth, async (req, res) => {
  const user = await getCurrentUser(req);
  const body = req.body || {};
  const judgment = {
    domain: body.domain,
    decided_by: body.decided_by || user?.username || 'unknown',
    decided_at: body.decided_at || new Date().toISOString().slice(0, 10),
    context: body.context || {},
    problem: body.problem,
    decision: body.decision,
    rationale: body.rationale,
    alternatives_considered: body.alternatives_considered || [],
    confidence: typeof body.confidence === 'number' ? body.confidence : Number(body.confidence),
    evidence_at_decision: body.evidence_at_decision || [],
    predictions: body.predictions || [],
  };

  // THE RULE: no falsifiable prediction -> refused at capture.
  const { ok, errors } = validateJudgment(judgment);
  if (!ok) return res.status(422).json({ error: 'Judgment refused at capture', reasons: errors });

  judgment.followups = computeFollowups(judgment, judgment.decided_at);
  judgment.observations = [];
  judgment.status = 'open';
  try {
    const row = await Judgment.create(judgment);
    logger.info(`Judgment captured: ${row.id} by ${judgment.decided_by} (${judgment.predictions.length} predictions)`);
    return res.status(201).json(withScore(row));
  } catch (e) {
    logger.error(`Judgment create failed: ${e.message}`);
    return res.status(500).json({ error: 'Could not save judgment', detail: e.message });
  }
});

// --- list ----------------------------------------------------------------
router.get('/', ensureDb, requireAuth, async (req, res) => {
  const where = {};
  if (req.query.expert) where.decided_by = req.query.expert;
  if (req.query.status) where.status = req.query.status;
  const rows = await Judgment.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
  res.json(rows.map(withScore));
});

// --- calibration (must precede /:id) -------------------------------------
router.get('/calibration', ensureDb, requireAuth, async (req, res) => {
  const where = {};
  if (req.query.expert) where.decided_by = req.query.expert;
  const rows = await Judgment.findAll({ where });
  if (!rows.length) return res.json({ expert: req.query.expert || null, judgments: 0, closed: 0, calibration: 'n/a' });
  res.json(calibrationForExpert(rows.map(r => r.toJSON())));
});

// --- follow-ups due ------------------------------------------------------
router.get('/followups/due', ensureDb, requireAuth, async (req, res) => {
  const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
  const rows = await Judgment.findAll({ where: { status: 'open' } });
  const due = [];
  for (const r of rows) {
    const j = r.toJSON();
    for (const f of j.followups || []) {
      if (f.status === 'pending' && f.due_at <= asOf) due.push({ judgment_id: j.id, decided_by: j.decided_by, ...f });
    }
  }
  res.json({ asOf, count: due.length, due });
});

// --- one -----------------------------------------------------------------
router.get('/:id', ensureDb, requireAuth, async (req, res) => {
  const row = await Judgment.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(withScore(row));
});

// --- record reality's answer ---------------------------------------------
router.post('/:id/observations', ensureDb, requireAuth, async (req, res) => {
  const row = await Judgment.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const j = row.toJSON();
  const { prediction_idx, value, observed_at, evidence } = req.body || {};
  if (prediction_idx == null || j.predictions[prediction_idx] === undefined)
    return res.status(400).json({ error: 'valid prediction_idx required' });
  if (value === undefined || value === null || value === '')
    return res.status(400).json({ error: 'observation value required' });

  const observations = [...(j.observations || []).filter(o => o.prediction_idx !== prediction_idx),
    { prediction_idx, value, observed_at: observed_at || new Date().toISOString().slice(0, 10), evidence: evidence || [] }];
  const followups = (j.followups || []).map(f => f.prediction_idx === prediction_idx ? { ...f, status: 'closed' } : f);
  const status = observations.length >= j.predictions.length ? 'closed' : 'open';
  const score = scoreJudgment({ ...j, observations });

  await row.update({ observations, followups, status, outcome: score.outcome, brier: score.brier });
  res.json(withScore(await Judgment.findByPk(req.params.id)));
});

export { router as judgmentRouter };
