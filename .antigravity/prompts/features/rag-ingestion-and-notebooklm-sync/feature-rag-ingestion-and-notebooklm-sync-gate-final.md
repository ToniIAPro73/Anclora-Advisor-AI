# Gate Final - rag-ingestion-and-notebooklm-sync

Feature ID: `ANCLORA-RAG-INGEST-001`

Decision esperada: `GO` solo si:

1. Los 3 cuadernos se ingirieron por MCP sin bloqueos.
2. `rag_documents` y `rag_chunks` consistentes.
3. Embeddings validados con dimension 384.
4. Chat responde con citas reales y politica anti-alucinacion.
5. `placeholder_chunks_detected = 0` en el scope parchado/reingestado.
6. `SOURCE_SCOPE_MISMATCH = none`.
7. `ENV_MISMATCH = none` y `SUPABASE_PROJECT_REF_CONFLICT = none`.
8. QA report completo con evidencias.

NO-GO automatico si:

- cualquier cuaderno no se pudo leer por MCP,
- existe mezcla de `project_ref` Supabase,
- hay embeddings con dimension distinta de 384,
- queda al menos 1 placeholder en contenido final.
