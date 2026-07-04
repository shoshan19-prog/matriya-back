/**
 * Morning MRI endpoint — GET /mri
 *
 * Aggregates LIVE system state server-side (DB counts, RAG collection, management
 * service ping, deployment sha) and returns ONLY the delta vs the previous run,
 * as at most 10 actionable items. Previous runs are stored in system_snapshots
 * (snapshot_type 'morning_mri'), so the delta needs no external state.
 *
 * LAW-EVIDENCE-001: every item carries `evidence` — 'live' (measured now) only;
 * nothing here is hardcoded. If a probe fails its item says so instead of guessing.
 */
import axios from 'axios';
import { Op } from 'sequelize';
import settings from './config.js';
import logger from './logger.js';
import {
  SearchHistory,
  Violation,
  SystemSnapshot,
  ResearchLoopRun,
  Experiment
} from './database.js';
import { requireAuth } from './authEndpoints.js';

const SNAPSHOT_TYPE = 'morning_mri';
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000; // don't spam a snapshot per refresh
const MAX_ITEMS = 10;

async function collectLiveMetrics(deps) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const metrics = {};

  // RAG collection (live count from pgvector)
  try {
    const info = await deps.getRagService().getCollectionInfo();
    metrics.rag_documents = info?.document_count ?? null;
  } catch (e) {
    metrics.rag_documents = null;
    metrics.rag_error = e.message;
  }

  // DB counts (each tolerant — a missing table must not kill the board)
  const safeCount = async (model, where) => {
    if (!model) return null;
    try { return await model.count(where ? { where } : undefined); } catch { return null; }
  };
  metrics.searches_24h = await safeCount(SearchHistory, { created_at: { [Op.gte]: since24h } });
  metrics.active_violations = await safeCount(Violation, { resolved_at: null });
  metrics.experiments_total = await safeCount(Experiment);
  metrics.research_runs_24h = await safeCount(ResearchLoopRun, { created_at: { [Op.gte]: since24h } });

  // Management service (live ping, short timeout)
  const managementBase = settings.MATRIYA_MANAGEMENT_API_URL || '';
  if (managementBase) {
    try {
      const r = await axios.get(`${managementBase}/health`, { timeout: 4000 });
      metrics.management_status = r.status === 200 ? 'connected' : `http_${r.status}`;
    } catch (e) {
      metrics.management_status = 'unreachable';
    }
  } else {
    metrics.management_status = 'not_configured';
  }

  // Self runtime metrics (in-process, live)
  try {
    const m = deps.getMetrics();
    metrics.latency_p99_ms = m.latency_p99 ?? null;
    metrics.total_errors = m.total_errors ?? null;
  } catch { /* metrics module optional */ }

  // Deployment identity (provided by Vercel at build/runtime — live, not hardcoded)
  metrics.deploy_sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;

  return metrics;
}

/**
 * Turn (previous, current) metrics into at most MAX_ITEMS actionable items.
 * Rules: show a metric only if it CHANGED since the previous run; standing
 * critical states (empty RAG, active violations, unreachable management)
 * surface as alerts because they demand action even when unchanged.
 */
function buildItems(prev, cur) {
  const items = [];
  const changed = (k) => !prev || prev[k] !== cur[k];

  // --- alerts (critical standing states, always actionable) ---
  if (cur.rag_documents === 0) {
    items.push({
      severity: 'red', kind: 'alert',
      title: 'מאגר הידע ריק — 0 מסמכים באינדקס',
      delta: prev && prev.rag_documents === 0 ? 'ללא שינוי' : `היה: ${prev?.rag_documents ?? '—'}`,
      action: { label: 'העלה מסמכים', tab: 'upload' },
      evidence: 'live'
    });
  }
  if ((cur.active_violations ?? 0) > 0) {
    items.push({
      severity: 'red', kind: 'alert',
      title: `${cur.active_violations} הפרות Integrity פעילות — השער נעול`,
      delta: prev ? `היה: ${prev.active_violations ?? 0}` : 'ריצה ראשונה',
      action: { label: 'פתח דשבורד Integrity', tab: 'admin' },
      evidence: 'live'
    });
  }
  if (cur.management_status && cur.management_status !== 'connected' && cur.management_status !== 'not_configured') {
    items.push({
      severity: 'red', kind: 'alert',
      title: `מערכת הניהול אינה זמינה (${cur.management_status})`,
      delta: prev && prev.management_status === cur.management_status ? 'ללא שינוי' : `היה: ${prev?.management_status ?? '—'}`,
      action: { label: 'בדוק את maneger-back', href: settings.MATRIYA_MANAGEMENT_API_URL || undefined },
      evidence: 'live'
    });
  }

  // --- deltas (only when changed) ---
  if (prev && changed('rag_documents') && cur.rag_documents !== null && cur.rag_documents > 0) {
    const d = cur.rag_documents - (prev.rag_documents ?? 0);
    items.push({
      severity: d >= 0 ? 'green' : 'yellow', kind: 'delta',
      title: `מסמכים באינדקס: ${cur.rag_documents} (${d >= 0 ? '+' : ''}${d})`,
      delta: `מאז הריצה הקודמת`,
      action: { label: d >= 0 ? 'שאל את המסמכים החדשים' : 'בדוק מחיקות', tab: d >= 0 ? 'ask' : 'admin' },
      evidence: 'live'
    });
  }
  if (prev && changed('experiments_total') && cur.experiments_total !== null) {
    const d = cur.experiments_total - (prev.experiments_total ?? 0);
    if (d !== 0) items.push({
      severity: 'green', kind: 'delta',
      title: `ניסויים במאגר: ${cur.experiments_total} (${d > 0 ? '+' : ''}${d})`,
      delta: 'סונכרנו ניסויי מעבדה חדשים',
      action: { label: 'הרץ ניתוח דמיון/כשלים', tab: 'search' },
      evidence: 'live'
    });
  }
  if (prev && changed('deploy_sha') && cur.deploy_sha) {
    items.push({
      severity: 'yellow', kind: 'delta',
      title: `פריסה חדשה: ${cur.deploy_sha}`,
      delta: `היה: ${prev.deploy_sha ?? '—'}`,
      action: { label: 'ודא תקינות', tab: 'admin' },
      evidence: 'live'
    });
  }
  if (prev && changed('searches_24h') && (cur.searches_24h ?? 0) > 0) {
    items.push({
      severity: 'green', kind: 'delta',
      title: `${cur.searches_24h} שאילתות ב-24 השעות האחרונות`,
      delta: `היה: ${prev.searches_24h ?? 0}`,
      action: { label: 'סקור היסטוריית חיפוש', tab: 'admin' },
      evidence: 'live'
    });
  }
  if (prev && changed('research_runs_24h') && (cur.research_runs_24h ?? 0) > 0) {
    items.push({
      severity: 'green', kind: 'delta',
      title: `${cur.research_runs_24h} ריצות מחקר ב-24 שעות`,
      delta: `היה: ${prev.research_runs_24h ?? 0}`,
      action: { label: 'פתח מחקר', tab: 'search' },
      evidence: 'live'
    });
  }

  return items.slice(0, MAX_ITEMS);
}

export function registerMriRoutes(app, deps) {
  app.get('/mri', requireAuth, async (req, res) => {
    const t0 = Date.now();
    try {
      const cur = await collectLiveMetrics(deps);

      let prevRow = null;
      if (SystemSnapshot) {
        try {
          prevRow = await SystemSnapshot.findOne({
            where: { snapshot_type: SNAPSHOT_TYPE },
            order: [['created_at', 'DESC']]
          });
        } catch (e) {
          logger.warn(`MRI: could not load previous snapshot: ${e.message}`);
        }
      }
      const prev = prevRow ? prevRow.payload : null;
      const items = buildItems(prev, cur);

      // Persist the new snapshot (throttled) so the NEXT run diffs against it.
      if (SystemSnapshot) {
        const freshEnough = prevRow &&
          (Date.now() - new Date(prevRow.created_at).getTime()) < SNAPSHOT_MIN_INTERVAL_MS;
        if (!freshEnough) {
          try {
            await SystemSnapshot.create({
              name: `morning-mri ${new Date().toISOString()}`,
              description: 'Automatic Morning MRI metrics snapshot',
              snapshot_type: SNAPSHOT_TYPE,
              payload: cur,
              created_by: req.user?.id ?? null
            });
          } catch (e) {
            logger.warn(`MRI: snapshot save failed (non-fatal): ${e.message}`);
          }
        }
      }

      return res.json({
        generated_at: new Date().toISOString(),
        previous_run: prevRow ? prevRow.created_at : null,
        first_run: !prevRow,
        no_change: prevRow ? items.length === 0 : false,
        items,
        took_ms: Date.now() - t0
      });
    } catch (e) {
      logger.error(`MRI endpoint failed: ${e.message}`);
      return res.status(500).json({ error: `MRI failed: ${e.message}` });
    }
  });
}
