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
   - source bundle can be overridden with `BUNDLE_PATH`

2. Website sync into NotebookLM notebooks
   - command: `npm run notebooklm:add-sources`
   - script: [add-notebooklm-sources.cjs](/c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/scripts/add-notebooklm-sources.cjs)
   - uses Playwright plus the saved NotebookLM browser state

## Auth model

The sync script reuses:

```text
%LOCALAPPDATA%/notebooklm-mcp/Data/browser_state/state.json
```

This avoids coupling source sync to the live MCP Chrome profile lock.

If the state expires, refresh auth from the MCP setup flow first.

## Governance enforced

For NotebookLM sync, each web source must carry:
- `notebook_id`
- `domain`
- `reason_for_fit`

Valid notebook/domain mapping:
- `fiscal` -> `ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- `laboral` -> `ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- `mercado` -> `ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`

If the bundle violates those rules, the sync script exits with `Decision=NO-GO`.

## Recommended local commands

```bash
DRY_RUN=1 npm run notebooklm:add-sources
NOTEBOOKLM_FILTER=fiscal npm run notebooklm:add-sources
NOTEBOOKLM_MAX_SOURCES=1 npm run notebooklm:add-sources
HEADLESS=1 npm run notebooklm:add-sources
```
