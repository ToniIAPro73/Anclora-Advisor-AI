# NotebookLM Local Tooling

## What `infra/mcp/notebooklm` is

`infra/mcp/notebooklm` is local operator tooling for Claude/Codex sessions.

It is not part of the runtime path of the application:
- it does not run in Next.js
- it does not deploy to Vercel
- it does not participate in Supabase runtime flows

Its purpose is limited to:
- maintaining a local NotebookLM library for MCP queries
- authenticating against NotebookLM
- supporting local audits and browser-assisted operations

## What MCP can and cannot do here

The installed `notebooklm-mcp` package can:
- register notebooks in the local library
- list/select/update notebook metadata
- ask questions against a notebook

It cannot:
- upload website URLs as new NotebookLM notebook sources

That limitation matters because the first version of `scripts/add-notebooklm-sources.cjs` attempted to use `update_notebook` to add sources, which is not supported by the package.

## Current source sync flow

There are now two separate flows:

1. RAG ingestion into Supabase
   - command: `npm run ingest`
   - script: [ingest-rag.ts](/c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/scripts/ingest-rag.ts)
   - default bundle remains `scripts/notebook_bundle_phase6_gold.json`
   - use `BUNDLE_PATH` only when you intentionally want a dated bundle such as `phase7_2026`

2. Website sync into NotebookLM notebooks
   - command: `npm run notebooklm:add-sources`
   - strict command: `npm run notebooklm:sync:strict`
   - script: [add-notebooklm-sources.cjs](/c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/scripts/add-notebooklm-sources.cjs)
   - uses Playwright plus the saved NotebookLM browser state
   - persists a local sync manifest to keep reruns idempotent
   - current dated sync bundle: [notebook_bundle_phase7_2026.json](/c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/scripts/notebook_bundle_phase7_2026.json)

3. MCP audit before NotebookLM sync
   - command: `npm run notebooklm:audit-sources`
   - script: [audit-notebooklm-sources.cjs](/c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/scripts/audit-notebooklm-sources.cjs)
   - calls `ask_question` through the NotebookLM MCP server with a strict GO/NO-GO prompt per notebook
   - if the MCP audit fails or rejects a source, the run stops with `Decision=NO-GO`

## Auth model

The sync script reuses:

```text
%LOCALAPPDATA%/notebooklm-mcp/Data/browser_state/state.json
```

This avoids coupling source sync to the live MCP Chrome profile lock.
The sync manifest is stored separately at `%LOCALAPPDATA%/notebooklm-mcp/Data/sync_state.json`.

If the state expires, refresh auth from the MCP setup flow first.

## Governance enforced

For NotebookLM sync, each web source must carry:
- `notebook_id`
- `domain`
- `reason_for_fit`
- enough thematic evidence in `title`, `content`, and `reason_for_fit`

Valid notebook/domain mapping:
- `fiscal` -> `ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- `laboral` -> `ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- `mercado` -> `ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`

If the bundle violates those rules, the sync script exits with `Decision=NO-GO`.
The preflight is now aligned with the app-side RAG governance, so a source is rejected before NotebookLM sync when it looks weak for the target notebook or closer to another notebook scope.

The strict workflow is therefore:
1. `npm run notebooklm:audit-sources`
2. `npm run notebooklm:add-sources`

Or in one command:

```bash
npm run notebooklm:sync:strict
```

Current operational caveat:
- The strict audit depends on a valid NotebookLM auth state and on the MCP server being able to answer `ask_question`.
- If the audit fails, first distinguish between a real NotebookLM/auth failure and a wrapper/protocol failure in the local script.
- `setup_auth` now falls back to an isolated persistent Chrome profile if the base profile is locked.
- Health validation should use `infra/mcp/notebooklm/probe_auth.cjs` or `bash infra/mcp/notebooklm/healthcheck.sh`, not just `get_health`, because cookie presence alone can still produce false positives.

## Recommended local commands

```bash
npm run notebooklm:audit-sources
NOTEBOOKLM_FILTER=fiscal npm run notebooklm:audit-sources
NOTEBOOKLM_AUDIT_TIMEOUT_MS=45000 npm run notebooklm:audit-sources
DRY_RUN=1 npm run notebooklm:add-sources
NOTEBOOKLM_FILTER=fiscal npm run notebooklm:add-sources
NOTEBOOKLM_MAX_SOURCES=1 npm run notebooklm:add-sources
HEADLESS=1 npm run notebooklm:add-sources
HEADLESS=1 npm run notebooklm:sync:strict
```
