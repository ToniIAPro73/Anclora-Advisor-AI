# Feature v1 - rag-ingestion-and-notebooklm-sync

Feature ID: `ANCLORA-RAG-INGEST-001`

Objetivo: habilitar ingesta de 3 cuadernos de NotebookLM al RAG usando MCP, con trazabilidad y calidad de grounding.

Alcance:

- Acceso MCP a 3 cuadernos.
- Normalizacion, chunking y embeddings.
- Persistencia en `rag_documents` y `rag_chunks`.
- Verificacion de retrieval y citas en chat.

Entregables:

- Pipeline implementado por Antigravity.
- Evidencias de validacion tecnica.
- QA report + gate final.

