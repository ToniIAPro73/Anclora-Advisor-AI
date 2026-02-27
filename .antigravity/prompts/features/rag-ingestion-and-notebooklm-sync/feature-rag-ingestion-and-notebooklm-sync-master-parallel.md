# Master Parallel - rag-ingestion-and-notebooklm-sync

Feature ID: `ANCLORA-RAG-INGEST-001`

## Agentes

- Agent A: Spec y contratos de ingesta.
- Agent B: MCP NotebookLM (extraccion y normalizacion).
- Agent C: Persistencia/embeddings en Supabase.
- Agent D: Integracion de retrieval/citas en chat.
- Agent E: QA y gate final.

## Orden de ejecucion

1. Agent A
2. Agent B + Agent C (en paralelo)
3. Agent D
4. Agent E
5. Gate final

## Politica de parada

- Cada agente debe producir evidencia verificable.
- Si falla acceso MCP a cualquier cuaderno, detener y marcar `NO-GO`.

