# CLAUDE.md — matriya-back

Guidance for Claude Code (and any AI agent) working in this repository. Read this before making changes.

## What this project is

**matriya-back** is the backend for the Matriya RAG (Retrieval-Augmented Generation) and research-session system.

- **Runtime:** Node.js 18+, **ESM** (`"type": "module"` — use `import`/`export`, never `require`).
- **Framework:** Express.js 4.18.2.
- **Database:** Supabase PostgreSQL with the `pgvector` extension, accessed via Sequelize 6 and the `pg` driver.
- **Embeddings:** local Hugging Face Transformers (`@xenova/transformers`, default `sentence-transformers/all-MiniLM-L6-v2`).
- **LLM:** Together AI by default; Hugging Face or OpenAI (file_search) as alternatives.
- **Language:** plain JavaScript. There is **no TypeScript** — do not add it.
- **Entry point:** `server.js` (~2000 lines), re-exported by `api/index.js` for Vercel serverless.

## How to run, build, and verify

```bash
npm run dev        # node --watch server.js  (local dev, default port 8000)
npm start          # node server.js           (production)
npm test           # runs the check-script suite (see below) — NOT a Jest/Mocha suite
```

There is **no build step** and **no linter** configured. Do not invent a `npm run lint` or `npm run build` — they don't exist.

`npm test` runs a sequence of real check scripts (`check:pre-llm-gate`, `verify:scope-signoff`, `verify:david-checklist`, `check:answer-binding`, `test:delete-guard`, `verify:chai-scope`, plus integration checks in `scripts/`). When you change retrieval, gating, scope, or answer-binding logic, **run `npm test` and report the actual output** before claiming the change works.

## Architecture & existing rules — respect these

This codebase already encodes domain rules in `docs/` and root markdown files. Read the relevant one before touching that area; do not contradict them.

- **Stage FSM** (`STAGE1_CHECKLIST.md`): research sessions progress through stages (K→C→B→N→L) with hard-stop logic. Don't bypass gates.
- **Scopes** (`docs/MATRIYA-SCOPES-1-2-3.md`): Knowledge / Combination / Business scopes of operation.
- **Pre-LLM gates** (`researchGate.js`, `docs/GATE-EVIDENCE-SCOPE-PRODUCTION.md`): evidence/scope must pass before the LLM is called. Keep these gates intact.
- **Answer attribution / source binding** (`lib/answerAttribution.js`, `lib/answerSourceBindingFilter.js`): answers must stay bound to retrieved sources.
- Layering: HTTP routes (`server.js`, `adminEndpoints.js`, `authEndpoints.js`) → business logic (`ragService.js`, `llmService.js`, `researchGate.js`) → DB (`database.js`). Keep new code in the right layer.

## Configuration

Secrets come from `.env` (see `env_example.txt`). Never hardcode keys or commit `.env`. Key vars: `POSTGRES_URL`, `JWT_SECRET`, `LLM_PROVIDER`, `TOGETHER_API_KEY`/`HF_API_TOKEN`/`OPENAI_API_KEY`, `EMBEDDING_MODEL`, `MATRIYA_RETRIEVAL_SIMILARITY_THRESHOLD`. Local and production must point at the **same Supabase project** (see `SHARED-DB-SETUP.md`).

## Working agreement (the important part)

1. **Don't over-engineer.** Match the scope of the request. This is plain-JS Express — solve the task with the smallest change that fits existing patterns. No new frameworks, no TypeScript, no abstraction layers, no dependencies unless the task genuinely requires them and you've said why.
2. **Follow instructions and existing conventions.** ESM, camelCase functions, PascalCase classes, UPPER_SNAKE_CASE constants. Reuse helpers in `lib/` rather than re-implementing. If a request conflicts with a documented rule above, stop and flag it instead of silently choosing.
3. **Don't claim done until it's verified.** "Done" means: the code runs, and the relevant `npm test` checks pass (or you ran the specific endpoint/script). If you couldn't verify something, say so explicitly and say why — never report success on unrun code.
4. **Don't invent APIs.** Use only Express/Sequelize/library methods and internal functions you've confirmed exist by reading the file. If unsure whether a helper, route, env var, or DB column exists, grep for it first. Don't guess endpoint shapes, column names, or model fields — check `database.js` and the route handlers.
5. **Surface uncertainty.** If the task is ambiguous, the file contradicts its description, or a change is large/risky, ask or flag rather than guessing.

## Git

- Develop on branch `claude/new-session-ydal7p`.
- Clear, descriptive commit messages. Do not open a PR unless explicitly asked.
- Never commit secrets, `.env`, or large generated artifacts.
