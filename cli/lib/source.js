/**
 * MATRIYA-LITE — data source.
 *
 * A read-only window onto the same Supabase/Postgres the API uses (it reuses
 * database.js, so there is one source of truth and no schema drift). It never
 * writes. If the DB env isn't configured, that absence is the answer, not a bug.
 */
import { Op } from 'sequelize';
import {
  sequelize,
  ResearchSession,
  Violation,
  IntegrityCycleSnapshot,
  DecisionAuditLog,
  ResearchLoopRun,
  NoiseEvent,
  STAGES_ORDER
} from '../../database.js';

export { STAGES_ORDER };

/** Thrown when there is simply nothing to read — surfaced honestly, not hidden. */
export class DataUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataUnavailable';
  }
}

export async function open() {
  if (!sequelize) {
    throw new DataUnavailable(
      'no database configured — set POSTGRES_URL or SUPABASE_DB_URL (the same store the API uses)'
    );
  }
  try {
    await sequelize.authenticate();
  } catch (e) {
    throw new DataUnavailable(`database unreachable — ${e.message}`);
  }
}

export async function close() {
  if (!sequelize) return;
  try {
    await sequelize.close();
  } catch {
    /* one-shot CLI: nothing to recover */
  }
}

export function sessions() {
  return ResearchSession.findAll({ order: [['updated_at', 'DESC']] });
}

export function violations({ openOnly = false } = {}) {
  const where = openOnly ? { resolved_at: { [Op.is]: null } } : {};
  return Violation.findAll({ where, order: [['created_at', 'DESC']] });
}

export function snapshots() {
  return IntegrityCycleSnapshot.findAll({ order: [['created_at', 'DESC']] });
}

export function decisions({ since = null } = {}) {
  const where = since ? { created_at: { [Op.gte]: since } } : {};
  return DecisionAuditLog.findAll({ where, order: [['created_at', 'DESC']] });
}

export function loopRuns({ since = null } = {}) {
  const where = since ? { created_at: { [Op.gte]: since } } : {};
  return ResearchLoopRun.findAll({ where, order: [['created_at', 'DESC']] });
}

export function noiseEvents() {
  return NoiseEvent.findAll({ order: [['created_at', 'DESC']] });
}
