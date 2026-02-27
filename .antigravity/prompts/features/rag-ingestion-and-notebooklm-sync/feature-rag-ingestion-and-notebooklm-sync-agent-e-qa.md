# Agent E (QA) - rag-ingestion-and-notebooklm-sync

Objetivo: validar ingesta + grounding y emitir gate.

Nota operativa:
- Si el equipo usa `Agent D` como QA en lugar de `Agent E`, aplicar este mismo checklist sin cambios.

Checklist QA:

1. Confirmar acceso MCP a los 3 cuadernos.
2. Confirmar documentos/chunks insertados por dominio.
3. Confirmar embeddings con dimension 384.
4. Confirmar handoff de Agent B (patch extraction):
   - `notebook_bundle_v1_patch.json` recibido
   - `placeholder_count = 0`
   - `SOURCE_SCOPE_MISMATCH = none`
   - todas las fuentes con `reason_for_fit`
5. Confirmar handoff de Agent C (targeted reingest):
   - reingesta solo de documentos parchados
   - `pending_before`, `updated_count`, `pending_after`
   - `pending_after = 0`
   - `bad_dim_count = 0`
   - `placeholder_chunks_detected = 0` en documentos parchados
6. Ejecutar consultas de verificacion:
   - 3 fiscales
   - 3 laborales
   - 3 mercado
7. Verificar citas en respuestas de chat.
8. Ejecutar checks tecnicos:
   - `npm run -s lint`
   - `npm run -s type-check`
   - `npm run -s build`
9. Verificar gobernanza de entorno:
   - `ENV_MISMATCH = none`
   - `SUPABASE_PROJECT_REF_CONFLICT = none`

Entregables:

- `QA_REPORT_RAG_INGEST_001.md`
- `GATE_FINAL_RAG_INGEST_001.md`
