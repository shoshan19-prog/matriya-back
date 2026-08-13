/**
 * Research Loop – 4-agent graph: analysis → research → critic → synthesis,
 * where the critic is a ROUTING node: it emits a verdict (sufficient / gap /
 * contradiction). On "gap" the loop returns to the research agent with the
 * critic's completion query (bounded rounds), so evidence gaps trigger another
 * research pass instead of being silently synthesized over.
 * After each agent: save output, create Justification if change.
 * Justification labels/descriptions come from justification templates when available.
 */
import logger from './logger.js';
import { ResearchLoopRun } from './database.js';
import { getJustificationDisplay } from './justificationTemplates.js';
import { evidenceFromSearchResults } from './lib/openaiFileSearchMatriya.js';

const AGENT_ORDER = ['analysis', 'research', 'critic', 'synthesis'];

/** Max extra research→critic rounds after the first critic verdict (termination criterion). */
const MAX_EXTRA_RESEARCH_ROUNDS = 2;

/**
 * Parse the critic's trailing "[VERDICT] ..." line.
 * Fail-open: no/malformed line => 'sufficient' (preserves pre-routing behavior).
 * Returns { verdict, detail, cleanText } — cleanText is the critic output without the verdict line.
 */
function parseCriticVerdict(text) {
  const raw = String(text || '');
  const m = raw.match(/\[VERDICT\]\s*(sufficient|gap|contradiction)\s*(?:\|\s*([\s\S]*?))?\s*$/i);
  if (!m) return { verdict: 'sufficient', detail: null, cleanText: raw.trim() };
  return {
    verdict: m[1].toLowerCase(),
    detail: (m[2] || '').trim() || null,
    cleanText: raw.slice(0, m.index).trim()
  };
}

function getAgentPrompt(agentName, query, previousOutput, ragContext = null) {
  const prev = previousOutput ? `\n\nPrevious step output:\n${String(previousOutput).slice(0, 2000)}` : '';
  const docContext = ragContext ? `\n\nDocument context (use if relevant):\n${String(ragContext).slice(0, 5000)}` : '';
  const base = `Query: ${query}${prev}${docContext}`;
  const hebrewOnly = ' Always respond in Hebrew (עברית) only. Do not use Arabic.';
  const prompts = {
    analysis: {
      system: 'You are the analysis agent. Analyze the query and previous context. Output a concise analysis in Hebrew (עברית) only.' + hebrewOnly,
      user: base
    },
    research: {
      system: 'You are the research agent. Based on the analysis and document context above, produce a short research summary in Hebrew (עברית) only.' + hebrewOnly,
      user: base
    },
    critic: {
      system:
        'You are the critic agent. Review the research output critically. Point out gaps or strengths briefly. Respond in Hebrew (עברית) only.' +
        ' End your reply with EXACTLY one machine-readable line, in this format:' +
        ' "[VERDICT] sufficient" if the research answers the query;' +
        ' "[VERDICT] gap | <שאילתת השלמה קצרה>" if information is missing;' +
        ' "[VERDICT] contradiction | <תיאור הסתירה>" if sources contradict each other.' +
        hebrewOnly,
      user: base
    },
    synthesis: {
      system: 'You are the synthesis agent. Synthesize the analysis, research, and critique into a final concise conclusion in Hebrew (עברית) only. Do not use Arabic.',
      user: base
    }
  };
  return prompts[agentName] || { system: 'Process the input.', user: base };
}

/**
 * Run one agent: build context and call LLM.
 */
async function runAgent(agentName, query, previousOutput, ragService, ragContextForResearch = null) {
  const { system, user } = getAgentPrompt(agentName, query, previousOutput, ragContextForResearch);
  const llm = ragService.llmService;
  if (!llm || !llm.isAvailable()) {
    return { output: null, error: 'LLM not available' };
  }
  const context = `${system}\n\n${user}`;
  const question = query;
  try {
    const output = await llm.generateAnswer(question, context, 600);
    return { output: output || '', error: null };
  } catch (e) {
    logger.error(`Research loop agent ${agentName} error: ${e.message}`);
    return { output: null, error: e.message };
  }
}

/**
 * Run the full 4-agent loop. After each agent: save output, justification if changed.
 * No Integrity Monitor – just the 4 agents (no K/C/B/N/L snapshots or violation checks).
 * @param {string} sessionId - Research session UUID
 * @param {string} query - User query
 * @param {object} ragService - RAG service (has llmService, generateAnswer)
 * @param {object|null} filterMetadata - Optional { filename } to restrict RAG to one file
 * @param {object|null} runOptions - Optional { pre_justification_text, doe_design_id }
 * @returns {Promise<{ run_id, outputs, justifications, error? }>}
 */
export async function runLoop(sessionId, query, ragService, filterMetadata = null, runOptions = null) {
  const startMs = Date.now();
  const outputs = {};
  const justifications = [];

  let previousOutput = null;
  let ragContext = null;
  let ragEvidenceSources = [];

  // When searching a single file, use fewer chunks; when no filter or multiple filenames (project scope), use more
  const filenamesList =
    filterMetadata && Array.isArray(filterMetadata.filenames)
      ? filterMetadata.filenames.filter((f) => typeof f === 'string' && f.trim())
      : [];
  const singleFilename =
    filterMetadata && typeof filterMetadata.filename === 'string' && filterMetadata.filename.trim();
  const singleFileFilter = Boolean(singleFilename) || filenamesList.length === 1;
  const isAllFiles = !singleFileFilter;
  const cloudReady = ragService._openAiFileSearchReady && ragService._openAiFileSearchReady();
  const nResults = isAllFiles ? (cloudReady ? 24 : 16) : 8;
  const maxContextChars = isAllFiles ? 6000 : 3000;

  try {
    if (ragService.generateAnswer) {
      const res = await ragService.generateAnswer(query, nResults, filterMetadata || null, false);
      ragEvidenceSources = evidenceFromSearchResults(res.results || [], undefined, undefined, query, null);
      let text = (res.context || res.results?.map(r => r.document || r.content).join('\n') || '').slice(0, maxContextChars);
      const hadFileFilter = filterMetadata && (
        (Array.isArray(filterMetadata.filenames) && filterMetadata.filenames.length > 0) ||
        (typeof filterMetadata.filename === 'string' && filterMetadata.filename.trim())
      );
      if (filterMetadata) {
        const files = Array.isArray(filterMetadata.filenames) && filterMetadata.filenames.length > 0
          ? filterMetadata.filenames
          : (typeof filterMetadata.filename === 'string' && filterMetadata.filename.trim() ? [filterMetadata.filename] : null);
        if (files && files.length > 0) {
          const sourceLine = `Sources (files) this answer is based on: ${files.join(', ')}.\n\n`;
          text = sourceLine + text;
        }
      }
      // When user asked about a specific file but no content was found, give agents a clear instruction instead of empty context (avoids LLM inventing "אין מידע זמין...")
      if (hadFileFilter && (!text || text.length < 100)) {
        const fileLabel = Array.isArray(filterMetadata.filenames) && filterMetadata.filenames.length > 0
          ? filterMetadata.filenames[0]
          : (filterMetadata.filename || '').trim();
        text = (text || '') + `[System note: No document content was found in the system for the selected file "${fileLabel}". Tell the user in Hebrew, briefly: לא נמצא תוכן במערכת עבור הקובץ שנבחר. ייתכן שהקובץ טרם עובד (אינדוקס) או שהשם לא תואם. נסה לבחור "כל הקבצים" או לבדוק שהקובץ מופיע ברשימה ולהמתין לסיום העיבוד.]
`;
      }
      // When searching "all files" but RAG returned no context (empty collection or no matches), tell the user clearly
      if (isAllFiles && (!text || text.length < 100)) {
        text = (text || '') + `[System note: No document content was found in the RAG system. Tell the user in Hebrew, briefly: לא נמצא תוכן במערכת. ייתכן שקבצים טרם עובדו (אינדוקס) בסביבה זו. וודא שהקבצים הועלו ושה-Matriya בסביבת ה-production מקבלת את העלאת הקבצים (MATRIYA_BACK_URL) ומחוברת לאותה מסד נתונים.]
`;
      }
      ragContext = text;
    }
  } catch (e) {
    logger.warn(`RAG context for research step: ${e.message}`);
  }

  // Graph traversal with a routing critic: analysis → (research → critic)×N → synthesis.
  // trace records every node visit + verdicts, so the run is replayable/auditable.
  const trace = [];
  let round = 1;
  let finalVerdict = null;
  let verdictDetail = null;

  const step = async (agentName, stepQuery) => {
    const { output, error } = await runAgent(agentName, stepQuery, previousOutput, ragService, ragContext);
    if (error) return { error: `Agent ${agentName} failed: ${error}` };
    const out = (output || '').trim();
    if (previousOutput !== null && out !== previousOutput) {
      const reasonCode = 'output_changed';
      const ctx = { agent: agentName, previous_snippet: String(previousOutput).slice(0, 200) };
      const display = await getJustificationDisplay(reasonCode, ctx);
      justifications.push({
        agent: agentName,
        reason: reasonCode,
        ...display,
        previous_snippet: ctx.previous_snippet,
        created_at: new Date().toISOString()
      });
    }
    previousOutput = out;
    return { out };
  };

  const fail = (msg) => ({ run_id: null, outputs, justifications, error: msg, sources: ragEvidenceSources });

  // Node: analysis
  let r = await step('analysis', query);
  if (r.error) return fail(r.error);
  outputs.analysis = r.out;
  trace.push({ node: 'analysis', round: 1 });

  // Loop: research → critic, routed by the critic's verdict (bounded).
  let researchQuery = query;
  for (;;) {
    r = await step('research', researchQuery);
    if (r.error) return fail(r.error);
    outputs.research = r.out;
    trace.push({ node: 'research', round });

    r = await step('critic', researchQuery);
    if (r.error) return fail(r.error);
    const { verdict, detail, cleanText } = parseCriticVerdict(r.out);
    outputs.critic = cleanText || r.out;
    previousOutput = outputs.critic; // synthesis should not see the machine line
    trace.push({ node: 'critic', round, verdict, detail: detail || undefined });
    finalVerdict = verdict;
    verdictDetail = detail;

    if (verdict === 'gap' && round <= MAX_EXTRA_RESEARCH_ROUNDS) {
      round += 1;
      researchQuery = detail ? `${query}\n\nהשלמת מידע נדרשת (מה-critic): ${detail}` : query;
      const display = await getJustificationDisplay('critic_gap_loop', { agent: 'critic', round });
      justifications.push({
        agent: 'critic',
        reason: 'critic_gap_loop',
        label: display?.label || 'פער ראיות — סבב מחקר נוסף',
        description: display?.description || (detail ? `ה-critic זיהה פער: ${detail}` : 'ה-critic זיהה פער מידע'),
        created_at: new Date().toISOString()
      });
      continue;
    }
    break;
  }

  // Node: synthesis (termination). On contradiction — surface it, never bury it.
  let synthQuery = query;
  if (finalVerdict === 'contradiction') {
    synthQuery = `${query}\n\n[חשוב: ה-critic זיהה סתירה בין מקורות${verdictDetail ? `: ${verdictDetail}` : ''}. ציין את הסתירה במפורש במסקנה ואל תסתיר אותה.]`;
  } else if (finalVerdict === 'gap') {
    synthQuery = `${query}\n\n[הערה: נותר פער מידע לאחר ${round} סבבי מחקר${verdictDetail ? `: ${verdictDetail}` : ''}. ציין במסקנה מה עדיין חסר.]`;
  }
  r = await step('synthesis', synthQuery);
  if (r.error) return fail(r.error);
  outputs.synthesis = r.out;
  trace.push({ node: 'synthesis', round });

  // Loop metadata rides inside outputs (JSONB) — no schema change, replayable from the run record.
  outputs.loop = {
    rounds: round,
    final_verdict: finalVerdict,
    verdict_detail: verdictDetail || null,
    trace
  };

  const durationMs = Date.now() - startMs;
  const opts = runOptions && typeof runOptions === 'object' ? runOptions : {};
  const runRecord = await saveRun(sessionId, query, outputs, justifications, false, null, durationMs, opts.pre_justification_text ?? null, opts.doe_design_id ?? null);
  return {
    run_id: runRecord?.id ?? null,
    outputs,
    justifications,
    duration_ms: durationMs,
    sources: ragEvidenceSources
  };
}

async function saveRun(sessionId, query, outputs, justifications, stoppedByViolation = false, violationId = null, durationMs = null, preJustificationText = null, doeDesignId = null) {
  if (!ResearchLoopRun) return null;
  try {
    const run = await ResearchLoopRun.create({
      session_id: sessionId,
      query,
      outputs: outputs || {},
      justifications: justifications || [],
      stopped_by_violation: stoppedByViolation,
      violation_id: violationId,
      duration_ms: durationMs,
      pre_justification_text: preJustificationText || null,
      doe_design_id: doeDesignId || null
    });
    return run;
  } catch (e) {
    logger.warn(`Failed to save research loop run: ${e.message}`);
    return null;
  }
}

export { AGENT_ORDER };
