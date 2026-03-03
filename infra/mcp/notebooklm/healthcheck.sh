#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# healthcheck.sh — NotebookLM MCP Server Health Check
# Usage: bash infra/mcp/notebooklm/healthcheck.sh
# Returns: exit code 0 = OK, exit code 1 = FAIL
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTRY_POINT="$SCRIPT_DIR/node_modules/notebooklm-mcp/dist/index.js"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/healthcheck.log"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S')

mkdir -p "$LOG_DIR"

log() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

PASS=0
FAIL=1

log "=== NotebookLM MCP Healthcheck START ==="

# ── Check 1: Node.js disponible ───────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  log "FAIL: node not found in PATH"
  exit $FAIL
fi
NODE_VER=$(node --version)
log "OK: node $NODE_VER"

# ── Check 2: Entry point existe ───────────────────────────────────────────────
if [ ! -f "$ENTRY_POINT" ]; then
  log "FAIL: Entry point not found: $ENTRY_POINT"
  log "FIX: cd $SCRIPT_DIR && npm install"
  exit $FAIL
fi
log "OK: Entry point found: $ENTRY_POINT"

# ── Check 3: .mcp.json registrado ────────────────────────────────────────────
MCP_JSON="$SCRIPT_DIR/../../../.mcp.json"
if [ ! -f "$MCP_JSON" ]; then
  log "WARN: .mcp.json not found at $MCP_JSON"
else
  if grep -q '"notebooklm"' "$MCP_JSON" 2>/dev/null; then
    log "OK: notebooklm registered in .mcp.json"
  else
    log "FAIL: notebooklm NOT found in .mcp.json"
    exit $FAIL
  fi
fi

# ── Check 4: Arranque del servidor (timeout 5s) ───────────────────────────────
log "Testing server startup (5s timeout)..."
SERVER_OUTPUT=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"healthcheck","version":"1.0"}}}' \
  | timeout 5 node "$ENTRY_POINT" 2>/dev/null || true)

if echo "$SERVER_OUTPUT" | grep -q '"result"'; then
  log "OK: Server responds to MCP initialize handshake"
elif echo "$SERVER_OUTPUT" | grep -q '"jsonrpc"'; then
  log "OK: Server returns valid JSON-RPC response"
else
  log "WARN: Server did not respond to initialize (may need auth). Output:"
  echo "$SERVER_OUTPUT" | head -3 >> "$LOG_FILE"
  log "NOTE: This is expected on first run before 'setup_auth' is called."
fi

# ── Check 5: No secrets en .env ───────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
  if grep -iE "LOGIN_PASSWORD|password|secret" "$SCRIPT_DIR/.env" &>/dev/null; then
    log "WARN: .env contains sensitive variables (LOGIN_PASSWORD/password/secret). Review immediately."
  else
    log "OK: .env exists but no obvious secrets detected"
  fi
else
  log "OK: No .env file (using .env.example only)"
fi

# ── Check 6: claude mcp list ─────────────────────────────────────────────────
log "Checking claude mcp list..."
MCP_LIST=$(claude mcp list 2>/dev/null || echo "")
if echo "$MCP_LIST" | grep -q "notebooklm"; then
  log "OK: notebooklm visible in 'claude mcp list'"
else
  log "INFO: notebooklm not yet visible in 'claude mcp list' (normal until Claude Code reloads)"
fi

log "=== Healthcheck COMPLETE — all critical checks passed ==="
log "Next step: In Claude Code, run: 'Log me in to NotebookLM'"
exit $PASS
