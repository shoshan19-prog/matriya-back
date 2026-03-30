/**
 * Domain: keep only retrieval rows/snippets that align with the query (token overlap).
 * Conclusion: logical readiness checks before calling the local LLM (vector path) or accepting cloud RAG output.
 */
import { retrievalSimilarityForGate, getRetrievalSimilarityThreshold } from '../researchGate.js';
import {
  chunkLikeHasStructuredData,
  detectStructuredDataInChunks,
  textHasStructuredPercentOrCompositionSignals
} from './detectStructuredFormulationChunks.js';

function tokenizeQuery(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 80);
}

/** Same idea as openaiFileSearchMatriya — match English ingredient labels in Hebrew questions. */
function latinTokensFromQuery(query) {
  const latin = String(query || '').match(/[a-zA-Z][a-zA-Z0-9.\-]{2,}/g) || [];
  const out = [];
  for (const w of latin) {
    const low = w.toLowerCase();
    if (low.length >= 2 && !out.includes(low)) out.push(low);
  }
  return out.slice(0, 24);
}

function queryTokensForDomain(query) {
  return [...tokenizeQuery(query), ...latinTokensFromQuery(query)].slice(0, 80);
}

export function getDomainFilterOptions() {
  const minOverlap = parseInt(process.env.MATRIYA_DOMAIN_MIN_QUERY_OVERLAP || '2', 10);
  return {
    /** Minimum sum of query-token hits in chunk text (2 pts per token). 0 = disable domain filter. */
    minQueryOverlap: Number.isFinite(minOverlap) ? Math.max(0, minOverlap) : 2
  };
}

function overlapScore(textLower, queryToks) {
  let s = 0;
  for (const t of queryToks) {
    if (t.length >= 2 && textLower.includes(t)) s += 2;
  }
  return s;
}

const COMPARISON_QUERY_RE =
  /השוואה|לעומת|\sמול\s|A\s+vs\s+B|דלתא|Δ|הפרש\s+בין|שתי\s+גרסאות|שתי\s+פורמולצ|compare|comparison|versus|vs\.?|delta/i;
const METADATA_ONLY_RE =
  /\b(astm|iso|iec|din|standard|standards|method|methods|test\s+method|procedure|procedures|note|notes|remark|remarks|regulation|compliance|norm|norms)\b|תקן|תקנים|שיטה|שיטות|הערה|הערות|נוהל|פרוצדורה/u;
const PCT_OR_FRACTION_RE = /\b\d{1,3}(?:\.\d+)?\s*%|\b0\.\d{2,8}\b/;
const RANGE_PCT_RE = /\b\d{1,3}(?:\.\d+)?\s*[-–]\s*\d{1,3}(?:\.\d+)?\s*%/;
const COMPOSITION_CUE_RE =
  /%|אחוז|percent|weight|ratio|wt\.?\b|w\/w|פורמול|הרכב|יחס|משקל|ingredient|formula|composition/i;
const TABLE_SEPARATOR_RE = /^\|\s*:?-{3,}.*\|$/;

function comparisonSumTolerance() {
  const v = parseFloat(process.env.MATRIYA_COMPARISON_SUM_TOLERANCE || '0.5');
  return Number.isFinite(v) && v > 0 ? v : 0.5;
}

function isComparisonQuery(query) {
  return COMPARISON_QUERY_RE.test(String(query || ''));
}

function textLooksMetadataOnly(text) {
  const t = String(text || '');
  if (!t.trim()) return true;
  const hasMetadata = METADATA_ONLY_RE.test(t);
  const hasPct = PCT_OR_FRACTION_RE.test(t) || textHasStructuredPercentOrCompositionSignals(t);
  return hasMetadata && !hasPct;
}

function chunkLooksLikeFormulation(row) {
  const text = String(row?.document ?? row?.text ?? '');
  if (!textHasStructuredPercentOrCompositionSignals(text)) return false;
  if (textLooksMetadataOnly(text)) return false;
  return true;
}

function extractPercentValuesFromLine(line) {
  const src = String(line || '');
  if (!src.trim()) return [];
  if (RANGE_PCT_RE.test(src)) return [];
  const vals = [];
  const pctMatches = src.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%/g);
  for (const m of pctMatches) {
    const n = parseFloat(String(m?.[1] || ''));
    if (Number.isFinite(n) && n >= 0 && n <= 100) vals.push(n);
  }
  if (vals.length > 0) return vals;
  if (!COMPOSITION_CUE_RE.test(src)) return [];
  const fracMatches = src.matchAll(/\b0\.(\d{2,8})\b/g);
  for (const m of fracMatches) {
    const f = parseFloat(`0.${String(m?.[1] || '')}`);
    const n = f * 100;
    if (Number.isFinite(n) && n > 0 && n <= 100) vals.push(n);
  }
  return vals;
}

function extractPercentCandidates(text) {
  const t = String(text || '');
  if (!t.trim()) return [];
  const out = [];
  const lines = t.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (textLooksMetadataOnly(line)) continue;
    const vals = extractPercentValuesFromLine(line);
    if (vals.length) out.push(...vals);
  }
  return out.slice(0, 120);
}

function hasWindowSummingTo100(values, tolerance) {
  const vals = Array.isArray(values) ? values.filter((x) => Number.isFinite(x) && x >= 0 && x <= 100) : [];
  if (vals.length < 2) return false;
  for (let i = 0; i < vals.length; i++) {
    let s = 0;
    for (let j = i; j < vals.length && j < i + 24; j++) {
      s += vals[j];
      const len = j - i + 1;
      if (len >= 2 && Math.abs(100 - s) <= tolerance) return true;
      if (s > 100 + tolerance) break;
    }
  }
  return false;
}

function fileHasNearHundredComposition(rows) {
  const tol = comparisonSumTolerance();
  const vals = [];
  for (const r of rows) {
    vals.push(...extractPercentCandidates(String(r?.document ?? r?.text ?? '')));
  }
  return hasWindowSummingTo100(vals, tol);
}

function isMarkdownTableOnly(answer) {
  const lines = String(answer || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  if (!lines.every((l) => l.startsWith('|') && l.endsWith('|'))) return false;
  if (!lines.some((l) => TABLE_SEPARATOR_RE.test(l))) return false;
  return true;
}

/**
 * Hard pre-generation gate for comparison requests.
 * Required conditions:
 * - two formulation sides
 * - percentage-bearing composition evidence
 * - no metadata-only snippets as the basis
 */
export function evaluateComparisonInputPreconditions(query, chunks) {
  if (!isComparisonQuery(query)) return { required: false, ok: true };
  const arr = Array.isArray(chunks) ? chunks : [];
  if (!arr.length) return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  const formulationRows = arr.filter((r) => chunkLooksLikeFormulation(r));
  const uniqueFiles = new Set(
    formulationRows
      .map((r) => String(r?.metadata?.filename || '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (formulationRows.length < 2) {
    return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  }
  if (uniqueFiles.size < 2) {
    return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  }
  const validCompositionFiles = new Set();
  for (const f of uniqueFiles) {
    const rowsForFile = formulationRows.filter(
      (r) => String(r?.metadata?.filename || '').trim().toLowerCase() === f
    );
    if (fileHasNearHundredComposition(rowsForFile)) validCompositionFiles.add(f);
  }
  if (validCompositionFiles.size < 2) {
    return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  }
  return { required: true, ok: true };
}

export function evaluateComparisonOutputMode(query, answer) {
  if (!isComparisonQuery(query)) return { required: false, ok: true };
  const out = String(answer || '').trim();
  if (!out) return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  if (/^INVALID\b/i.test(out)) return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  if (!isMarkdownTableOnly(out)) return { required: true, ok: false, code: 'INVALID_COMPARISON_INPUT' };
  return { required: true, ok: true };
}

/**
 * Drop chunks with no query-term presence when the query has lexical tokens (numbers-only → no filter).
 * @param {string} query
 * @param {object[]} rows - RAG rows { document, text, metadata, ... }
 */
export function filterRetrievalRowsByQueryDomain(query, rows) {
  const { minQueryOverlap } = getDomainFilterOptions();
  const arr = Array.isArray(rows) ? rows : [];
  if (minQueryOverlap <= 0) return arr;

  const qt = queryTokensForDomain(query);
  if (qt.length === 0) return arr;

  const scored = arr.map((r) => {
    const low = String(r.document ?? r.text ?? '').toLowerCase();
    return { r, overlap: overlapScore(low, qt) };
  });
  const maxO = Math.max(0, ...scored.map((x) => x.overlap));
  if (maxO === 0) {
    if (arr.length > 1) return arr;
    const structuredOnly = arr.filter((r) => chunkLikeHasStructuredData(r));
    if (structuredOnly.length) return structuredOnly;
    return [];
  }

  const filtered = scored.filter((x) => x.overlap >= minQueryOverlap).map((x) => x.r);
  const filteredSet = new Set(filtered);
  const extra = arr.filter((r) => chunkLikeHasStructuredData(r) && !filteredSet.has(r));
  return extra.length ? [...filtered, ...extra] : filtered;
}

/**
 * @param {string} query
 * @param {{ filename?: string, text?: string }[]} snippets
 */
export function filterSnippetsByQueryDomain(query, snippets) {
  const { minQueryOverlap } = getDomainFilterOptions();
  const list = Array.isArray(snippets) ? snippets : [];
  if (minQueryOverlap <= 0) return list;

  const qt = queryTokensForDomain(query);
  if (qt.length === 0) return list;

  const scored = list.map((s) => {
    const low = String(s.text ?? s.excerpt ?? '').toLowerCase();
    return { s, overlap: overlapScore(low, qt) };
  });
  const maxO = Math.max(0, ...scored.map((x) => x.overlap));
  if (maxO === 0) {
    if (list.length > 1) return list;
    const structuredOnly = list.filter((s) =>
      textHasStructuredPercentOrCompositionSignals(s.text ?? s.excerpt ?? '')
    );
    if (structuredOnly.length) return structuredOnly;
    return [];
  }

  const filtered = scored.filter((x) => x.overlap >= minQueryOverlap).map((x) => x.s);
  const filteredSet = new Set(filtered);
  const extra = list.filter(
    (s) =>
      textHasStructuredPercentOrCompositionSignals(s.text ?? s.excerpt ?? '') &&
      !filteredSet.has(s)
  );
  return extra.length ? [...filtered, ...extra] : filtered;
}

export function getGenerationReadinessOptions() {
  const minChunks = Math.max(1, parseInt(process.env.MATRIYA_GENERATION_MIN_CHUNKS || '1', 10) || 1);
  const minTopKSum = parseFloat(process.env.MATRIYA_GENERATION_MIN_TOPK_SIMILARITY_SUM || '0');
  return {
    minChunks,
    minTopKSimilaritySum: Number.isFinite(minTopKSum) && minTopKSum > 0 ? minTopKSum : 0,
    topKForSum: Math.max(1, Math.min(5, parseInt(process.env.MATRIYA_GENERATION_TOPK_SUM_K || '3', 10) || 3))
  };
}

/**
 * Preconditions before surfacing an LLM answer (vector generation) or trusting evidence-backed replies.
 * @param {string} query
 * @param {object[]} chunks - post-similarity, post-domain rows
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function evaluateConclusionBeforeGeneration(query, chunks) {
  const { minChunks, minTopKSimilaritySum, topKForSum } = getGenerationReadinessOptions();
  const arr = Array.isArray(chunks) ? chunks : [];
  if (arr.length < minChunks) {
    return { ok: false, code: 'INSUFFICIENT_EVIDENCE' };
  }

  const cmpGate = evaluateComparisonInputPreconditions(query, arr);
  if (cmpGate.required && !cmpGate.ok) {
    return { ok: false, code: cmpGate.code || 'INVALID_COMPARISON_INPUT' };
  }

  if (detectStructuredDataInChunks(arr)) {
    return { ok: true };
  }

  const thr = getRetrievalSimilarityThreshold();
  const sorted = [...arr].sort((a, b) => retrievalSimilarityForGate(b) - retrievalSimilarityForGate(a));
  const topSim = retrievalSimilarityForGate(sorted[0]);
  if (topSim < thr) {
    return { ok: false, code: 'INSUFFICIENT_EVIDENCE' };
  }

  if (minTopKSimilaritySum > 0) {
    const k = Math.min(topKForSum, sorted.length);
    const sum = sorted.slice(0, k).reduce((acc, c) => acc + retrievalSimilarityForGate(c), 0);
    if (sum < minTopKSimilaritySum) {
      return { ok: false, code: 'INSUFFICIENT_EVIDENCE' };
    }
  }

  return { ok: true };
}
