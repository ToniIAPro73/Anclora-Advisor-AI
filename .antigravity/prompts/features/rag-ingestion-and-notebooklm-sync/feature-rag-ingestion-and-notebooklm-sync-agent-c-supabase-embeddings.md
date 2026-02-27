# Agent C (Supabase + Embeddings) - rag-ingestion-and-notebooklm-sync

Objetivo: persistir documentos/chunks y generar embeddings 384.

Entradas requeridas:

- `notebook_bundle_v1`
- `EMBEDDING_MODEL_NAME`
- `EMBEDDING_DIM=384`

Secuencia requerida:

1. Alta/actualizacion en `rag_documents` por cuaderno.
2. Chunking determinista sobre contenido normalizado.
3. Generacion de embeddings con dimension 384.
4. Insercion en `rag_chunks`:
   - `document_id`
   - `content`
   - `embedding`
   - `token_count` (si aplica)
5. Verificacion de cardinalidad:
   - chunks por documento
   - embeddings no nulos
   - dimension valida

Validaciones:

- Si la dimension != 384, detener con `NO-GO`.
- Si hay chunks sin `document_id`, detener.

Salida esperada:

- Base RAG poblada y consistente para retrieval.

