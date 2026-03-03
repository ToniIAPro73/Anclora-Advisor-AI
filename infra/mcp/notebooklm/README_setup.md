# NotebookLM MCP Server — Setup & Operations

## What this is

Local, isolated installation of [`notebooklm-mcp`](https://github.com/PleasePrompto/notebooklm-mcp) for the `anclora-advisor-ai` project.

Connects Claude Code to Google NotebookLM via MCP (stdio transport), enabling grounded, citation-backed answers from Gemini without leaving your coding context.

Important scope note:
- This folder is local tooling, not runtime infrastructure for the Next.js app.
- `notebooklm-mcp` manages NotebookLM library metadata and question/answer sessions.
- It does not expose a tool to upload new website sources into a notebook.
- Web source sync is handled separately by `scripts/add-notebooklm-sources.cjs` via Playwright.

## Transport

```
stdio — registered in .mcp.json at project scope
```

## First-time authentication

The server uses browser automation (Playwright/Chromium) to authenticate with Google:

1. Open Claude Code in this project
2. Tell Claude: **"Log me in to NotebookLM"** (uses `setup_auth` tool)
3. A browser window will open — log in with your Google account
4. Credentials are stored locally at `~/.config/notebooklm-mcp/settings.json`
5. Never stored in this repo

> Use a dedicated Google account for automation if possible.

## Available tools (NOTEBOOKLM_PROFILE=standard)

| Tool | Description |
|------|-------------|
| `ask_question` | Query a notebook with natural language |
| `get_health` | Server health check |
| `list_notebooks` | List all notebooks in your library |
| `select_notebook` | Switch active notebook |
| `get_notebook` | Get notebook details |
| `setup_auth` | Initiate Google login |
| `list_sessions` | Active browser sessions |
| `add_notebook` | Create a new notebook |
| `update_notebook` | Modify notebook metadata only |
| `search_notebooks` | Search across library |

## Browser state

NotebookLM auth state is stored outside the repo:

```text
%LOCALAPPDATA%/notebooklm-mcp/Data/browser_state/state.json
```

That file can be reused by local browser automations without reopening the main MCP Chrome profile.

## Re-install from scratch

```bash
cd infra/mcp/notebooklm
rm -rf node_modules
npm install
```

## Rollback

Pre-install snapshot is at:
```
setup_backups/mcp_pre_install_20260303_051946/
```

To rollback:
1. Delete `infra/mcp/notebooklm/`
2. Remove `notebooklm` entry from `.mcp.json`
3. Restore `.mcp.json` from snapshot if needed

## Healthcheck

```bash
bash infra/mcp/notebooklm/healthcheck.sh
```

Returns exit code 0 if the server starts correctly.

## Logs

Runtime logs: `infra/mcp/notebooklm/logs/notebooklm-mcp.log`

## Syncing website sources into NotebookLM

Use the repo-level script instead of MCP metadata tools:

```bash
npm run notebooklm:add-sources
```

Useful flags:

```bash
DRY_RUN=1 npm run notebooklm:add-sources
NOTEBOOKLM_FILTER=fiscal npm run notebooklm:add-sources
NOTEBOOKLM_MAX_SOURCES=1 npm run notebooklm:add-sources
HEADLESS=1 npm run notebooklm:add-sources
```

Governance checks enforced by the script:
- `domain` must map to the expected Anclora notebook
- `notebook_id` must exist
- each web source must include `reason_for_fit`

If any rule fails, the script exits with:

```text
Decision=NO-GO
```
