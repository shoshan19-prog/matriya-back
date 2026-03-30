/**
 * LLM Service for generating answers using Together AI or Hugging Face API
 */
import axios from 'axios';
import logger from './logger.js';
import settings from './config.js';

const RAG_MEASUREMENT_SCHEMA_RULES = [
  'Apply the JSON schema ONLY for explicit measurement extraction requests (e.g. viscosity, pH, cps, percentages).',
  'Do NOT use JSON schema for A/B comparison-table requests; comparison mode is table-only or INVALID.',
  'If the question is not explicitly a measurement/comparison request, DO NOT output JSON and answer in normal prose.',
  'When JSON mode is required, output a strict JSON object first (no prose before it) with these keys:',
  '{"measurements":[],"comparisons":[],"evidence_links":[],"document_classification":[],"notes":[]}.',
  'Each measurement item must include: metric, value, unit, conditions (rpm, temperature_c, sample, stage), and source_ref.',
  'CPS comparison rule (mandatory): only compare cps values when RPM is explicitly present and equal on both sides; otherwise set comparable=false and explain in reason.',
  'RAG-to-experiment linkage: prioritize evidence where unit + conditions both match; fallback order is (1) same metric+unit, (2) same metric only, and mark weaker match in notes.',
  'Document classification: classify every cited source as one of formulation | experiment_result | qc_data with confidence high|medium|low.',
  'For viscosity/pH conclusions, prioritize experiment_result and qc_data evidence over formulation-only text. For composition percentages, prioritize formulation evidence.',
  'Cross-field consistency: never merge values across different units/conditions into one conclusion. If conflicting evidence exists, report conflict explicitly in notes.',
  'Use only the provided context; do not invent missing values.'
].join(' ');

class LLMService {
  /**Service for generating answers using Together AI or Hugging Face API*/
  
  constructor() {
    this.provider = settings.LLM_PROVIDER.toLowerCase();
    
    if (this.provider === "together") {
      this.apiKey = settings.TOGETHER_API_KEY;
      this.model = settings.TOGETHER_MODEL;
      this.apiUrl = "https://api.together.xyz/v1/chat/completions";
    } else {
      // Hugging Face
      this.apiKey = settings.HF_API_TOKEN;
      this.model = settings.HF_MODEL;
      this.apiUrl = `https://api-inference.huggingface.co/models/${this.model}`;
    }
    
    if (!this.apiKey) {
      logger.warn(`${this.provider.toUpperCase()} API key not set. LLM generation will not work.`);
    }
  }

  async generateAnswer(question, context, maxLength = 500, citationOnly = false) {
    /**
     * Generate an answer based on question and context from RAG
     *
     * Args:
     *   question: User's question
     *   context: Relevant text chunks from RAG search
     *   max_length: Maximum length of generated answer
     *   citation_only: Stage K/C – cite existing knowledge only, no interpretation
     *
     * Returns:
     *   Generated answer or null if error
     */
    if (!this.apiKey) {
      logger.error(`Cannot generate answer: ${this.provider.toUpperCase()} API key not configured`);
      return null;
    }

    // חוק קרנל – שלב K: only quote existing knowledge, no explanation, no inference
    const citationOnlySystem =
      "בשלב קרנל K/C: רק צטט ידע קיים מהמסמכים. אסור להסביר למה, להסיק התאמה או להוסיף משמעות. " +
      "אל תקבע «הכי טוב», «מומלץ» או מנצח בהשוואת פורמולות אלא אם המסמך מצטט זאת במפורש. " +
      "פורמט: \"במסמך X מופיע: [ציטוט מדויק]\". אם אין במסמכים מידע רלוונטי: אין במערכת מידע תומך לשאלה זו. " +
      "ענה בעברית בלבד. אסור להשתמש בערבית. " +
      RAG_MEASUREMENT_SCHEMA_RULES;
    const defaultSystem =
      "Based on the given context, answer the question clearly and concisely. You must respond in Hebrew (עברית) only. Do not use Arabic. " +
      "Do not state which formulation is best, recommended, or superior unless the context explicitly says so; describe only what appears in the context. " +
      "If the context does not contain enough information to answer, respond with this single Hebrew sentence only — no bullet lists, no recommendations, no next steps: אין במערכת מידע תומך לשאלה זו. " +
      RAG_MEASUREMENT_SCHEMA_RULES;
    const systemPrompt = citationOnly ? citationOnlySystem : defaultSystem;
    const userContent = `Context:\n${context}\n\nQuestion: ${question}`;
    
    try {
      if (this.provider === "together") {
        // Together AI Chat Completions API (supports Qwen and other chat models)
        const response = await axios.post(
          this.apiUrl,
          {
            model: this.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent }
            ],
            max_tokens: maxLength,
            temperature: settings.LLM_TEMPERATURE,
            top_p: 0.9,
            stop: ["\n\nQuestion:", "Context:", "Answer:"]
          },
          {
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 60000
          }
        );
        
        if (response.status === 200) {
          const result = response.data;
          // Chat completions: choices[0].message.content
          let generatedText = "";
          if (result.choices && result.choices.length > 0) {
            const msg = result.choices[0].message;
            generatedText = (msg && msg.content) ? msg.content : (result.choices[0].text || "");
          }
          
          let answer = generatedText.trim();
          if (answer.includes("Answer:")) {
            answer = answer.split("Answer:")[answer.split("Answer:").length - 1].trim();
          }
          
          logger.info(`Generated answer using Together AI (length: ${answer.length})`);
          return answer || null;
        } else {
          const errorMsg = response.data?.error || response.statusText;
          logger.error(`Together AI API error ${response.status}: ${errorMsg}`);
          return null;
        }
      } else {
        // Hugging Face: keep prompt format
        const instruction = citationOnly
          ? `בשלב קרנל K/C: רק צטט ידע קיים מהמסמכים. אסור להסביר, להסיק או להוסיף משמעות. פורמט: "במסמך X מופיע: [ציטוט]". אם אין מידע: אין במערכת מידע תומך לשאלה זו. ${RAG_MEASUREMENT_SCHEMA_RULES} `
          : `Based on the following context, answer the question clearly and concisely. ${RAG_MEASUREMENT_SCHEMA_RULES} `;
        const prompt = `${instruction}IMPORTANT: You must respond in Hebrew (עברית) only. Do not use Arabic.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer (in Hebrew only):`;
        // Hugging Face API format
        const response = await axios.post(
          this.apiUrl,
          {
            inputs: prompt,
            parameters: {
              max_new_tokens: maxLength,
              temperature: settings.LLM_TEMPERATURE,
              top_p: 0.9,
              return_full_text: false
            },
            options: {
              wait_for_model: true
            }
          },
          {
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 60000
          }
        );
        
        if (response.status === 200) {
          const result = response.data;
          let generatedText = "";
          if (Array.isArray(result) && result.length > 0) {
            generatedText = result[0].generated_text || '';
          } else if (typeof result === 'object') {
            generatedText = result.generated_text || '';
          } else {
            generatedText = String(result);
          }
          let answer = generatedText.trim();
          
          if (answer.includes("Answer:")) {
            answer = answer.split("Answer:")[answer.split("Answer:").length - 1].trim();
          }
          
          logger.info(`Generated answer using Hugging Face (length: ${answer.length})`);
          return answer || null;
        } else if (response.status === 503) {
          const errorMsg = response.data?.error || response.statusText;
          logger.warn(`Hugging Face service unavailable (503): ${errorMsg}`);
          return "המודל AI לא זמין כרגע. אנא נסה שוב בעוד כמה שניות.";
        } else {
          logger.error(`Hugging Face API error ${response.status}: ${response.statusText}`);
          return null;
        }
      }
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
        logger.error(`${this.provider.toUpperCase()} API request timed out`);
      } else if (e.response) {
        logger.error(`${this.provider.toUpperCase()} API request failed: ${e.response.status} - ${e.response.statusText}`);
      } else {
        logger.error(`${this.provider.toUpperCase()} API request failed: ${e.message}`);
      }
      return null;
    }
  }
  
  isAvailable() {
    /**Check if LLM service is available*/
    return this.apiKey != null && this.apiKey !== "";
  }
}

export default LLMService;
