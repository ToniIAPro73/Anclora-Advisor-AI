# Launch Playbook - Antigravity

Usa este bloque como prompt inicial al agente maestro de Antigravity:

```text
Feature: ANCLORA-RAG-INGEST-001
Modo: implementacion completa por agentes

Contexto obligatorio:
- .antigravity/prompts/features/rag-ingestion-and-notebooklm-sync/feature-rag-ingestion-and-notebooklm-sync-shared-context.md
- .antigravity/prompts/features/rag-ingestion-and-notebooklm-sync/feature-rag-ingestion-and-notebooklm-sync-master-parallel.md

Variables de ejecucion:
- NOTEBOOK_1_ID=ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL
- NOTEBOOK_2_ID=ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL
- NOTEBOOK_3_ID=ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO
- NOTEBOOK_1_DOMAIN=fiscal
- NOTEBOOK_2_DOMAIN=laboral
- NOTEBOOK_3_DOMAIN=mercado
- MCP_NOTEBOOKLM_PROVIDER=<nombre-mcp>
- EMBEDDING_MODEL_NAME=<modelo-embeddings>
- EMBEDDING_DIM=384

Instrucciones:
1) Ejecuta Agent A y congela spec/test-plan.
2) Ejecuta Agent B (MCP NotebookLM) y Agent C (Supabase/embeddings) en paralelo.
3) Ejecuta Agent D para retrieval y citas en chat.
4) Ejecuta Agent E para QA y gate final.
5) Devuelve evidencia de:
   - accesos MCP a 3 cuadernos
   - cantidad de rag_documents/rag_chunks
   - validacion embedding dim=384
   - 9 consultas de prueba (3 por dominio) con citas.
6) Si cualquier cuaderno falla en acceso MCP, detener con NO-GO.
```

Prompt para Agent B directo (solo ingesta MCP):

```text
Ejecuta .antigravity/prompts/features/rag-ingestion-and-notebooklm-sync/feature-rag-ingestion-and-notebooklm-sync-agent-b-mcp-notebooklm.md
con:
- NOTEBOOK_1_ID=ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL
- NOTEBOOK_2_ID=ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL
- NOTEBOOK_3_ID=ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO
- MCP_NOTEBOOKLM_PROVIDER=<...>
Devuelve notebook_bundle_v1 listo para chunking.
```
