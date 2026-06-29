/**
 * Knowledge Ledger emitter — posts knowledge movements to the platform
 * control plane (matriya-system) so Knowledge Growth runs on real data.
 *
 * Safety contract: this must NEVER affect the product. It is a no-op unless
 * KNOWLEDGE_LEDGER_URL is set, it is fire-and-forget (never awaited in a
 * request path), it has a short timeout, and it swallows every error.
 */
import axios from 'axios';
import logger from './logger.js';

const SOURCE = 'matriya-back';

export function emitKnowledgeEvent(type, subject = '', payload) {
  const base = process.env.KNOWLEDGE_LEDGER_URL;
  if (!base) return; // disabled until the control plane URL is configured
  const url = base.replace(/\/+$/, '') + '/api/knowledge/events';
  axios
    .post(url, { type, subject, source: SOURCE, ...(payload ? { payload } : {}) }, { timeout: 2500 })
    .catch((e) => {
      try { logger.warn(`knowledge emit failed (${type}): ${e.message}`); } catch (_) {}
    });
}
