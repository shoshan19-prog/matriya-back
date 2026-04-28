/**
 * Phase A — write a shadow decision_audit_log row from /ask-matriya.
 *
 * /ask-matriya is not session-aware (it bypasses the K/C/B/N/L state machine
 * and answers from full indexed text or materials-library context). To still
 * record what the kernel would say, we create an ad-hoc research_sessions
 * row per request and persist a single decision_audit_log row tagged with
 * stage='ask_matriya'.
 *
 * Never throws. Never alters the user-facing response.
 */

import logger from '../logger.js';
import { DecisionAuditLog } from '../database.js';
import { getOrCreateSession, getGateObservabilityContext } from '../researchGate.js';
import { isDecisionAuditEnabled, isKernelShadowEnabled } from './researchEngineFlags.js';
import { computeShadowVerdict } from './shadowKernel.js';

/**
 * @param {object} input
 * @param {string} input.query
 * @param {string} [input.decision]              - 'shadow_allow' | 'shadow_error' | 'shadow_block'
 * @param {number} [input.statusCode]
 * @param {string[]} [input.filenames]
 * @param {number} [input.evidenceCount]
 * @param {string} [input.askMode]               - 'documents' | 'materials_library' | null
 */
export async function writeAskMatriyaShadowAudit(input = {}) {
  if (!isDecisionAuditEnabled()) return null;
  if (!DecisionAuditLog) return null;

  const query = input.query != null ? String(input.query) : '';
  const decision = input.decision || 'shadow_allow';
  const statusCode = Number.isFinite(input.statusCode) ? Number(input.statusCode) : null;
  const filenames = Array.isArray(input.filenames) ? input.filenames.filter(Boolean).slice(0, 50) : [];
  const evidenceCount = Number.isFinite(input.evidenceCount) ? Number(input.evidenceCount) : 0;
  const askMode = input.askMode || null;

  let sessionId = null;
  try {
    const created = await getOrCreateSession(null, null);
    sessionId = created?.session?.id ?? null;
  } catch (e) {
    logger.warn(`[shadow] ask-matriya getOrCreateSession failed: ${e.message}`);
    return null;
  }
  if (!sessionId) return null;

  let shadow = null;
  if (isKernelShadowEnabled()) {
    try {
      shadow = computeShadowVerdict({
        stage: null,
        kernel_signals: null,
        data_anchors: null,
        methodology_flags: null,
        evidence_count: evidenceCount
      });
    } catch (e) {
      logger.warn(`[shadow] ask-matriya verdict failed: ${e.message}`);
    }
  }

  const gateCtx = getGateObservabilityContext();

  try {
    await DecisionAuditLog.create({
      session_id: sessionId,
      stage: 'ask_matriya',
      decision,
      response_type: askMode || 'ask_matriya',
      request_query: query.slice(0, 4000),
      inputs_snapshot: {
        ask_mode: askMode,
        filenames,
        file_count_in_request: filenames.length,
        evidence_count: evidenceCount,
        http_status: statusCode
      },
      details: {
        shadow_only: true,
        source: 'ask-matriya',
        ...(shadow ? { shadow_decision: shadow } : {})
      },
      confidence_score: gateCtx?.confidence_score ?? null,
      basis_count: evidenceCount,
      model_version_hash: gateCtx?.model_version_hash || null,
      complexity_context: null
    });
    return sessionId;
  } catch (e) {
    logger.warn(`[shadow] ask-matriya audit write failed: ${e.message}`);
    return null;
  }
}
