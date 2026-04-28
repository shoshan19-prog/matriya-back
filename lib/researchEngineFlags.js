/**
 * Phase A — research-engine activation flags.
 *
 * All three flags are read-only behavioural toggles for shadow-mode logging.
 * None of them block answers or change response shape today.
 *
 * Defaults:
 *   - ON when NODE_ENV is anything other than 'production'
 *   - OFF in production unless explicitly set to 'true' / '1'
 *
 * Recognised env values (case-insensitive):
 *   'true'  / '1'  → enabled
 *   'false' / '0'  → disabled
 *   anything else  → fall through to default
 */

function readBooleanFlag(envName) {
  const raw = process.env[envName];
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return null;
}

function defaultOnInDev(envName) {
  const explicit = readBooleanFlag(envName);
  if (explicit != null) return explicit;
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  return nodeEnv !== 'production';
}

/** When true, save the evidence array onto research_loop_runs.evidence. */
export function isPersistEvidenceEnabled() {
  return defaultOnInDev('MATRIYA_PERSIST_EVIDENCE');
}

/** When true, write a decision_audit_log row from the live answer path. */
export function isDecisionAuditEnabled() {
  return defaultOnInDev('MATRIYA_DECISION_AUDIT');
}

/**
 * When true, compute the kernel-v16 verdict and store it inside
 * decision_audit_log.details.shadow_decision. Never blocks.
 */
export function isKernelShadowEnabled() {
  return defaultOnInDev('MATRIYA_KERNEL_SHADOW');
}

/** Snapshot for dashboards / health endpoints. */
export function getPhaseAFlagsSnapshot() {
  return {
    persist_evidence: isPersistEvidenceEnabled(),
    decision_audit: isDecisionAuditEnabled(),
    kernel_shadow: isKernelShadowEnabled(),
    node_env: process.env.NODE_ENV || null
  };
}
