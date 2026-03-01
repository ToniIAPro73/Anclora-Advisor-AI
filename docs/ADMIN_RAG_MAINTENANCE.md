# Admin RAG Maintenance

## Alcance
- Snapshots versionados de documentos RAG antes de `replace_existing` y antes de borrado.
- Historial de versiones visible desde `/dashboard/admin`.
- Rollback operativo de metadata + chunks desde una version previa.

## Infraestructura
- Tabla `rag_document_versions`.
- Cada snapshot guarda:
  - documento (`title`, `category`, `source_url`, `doc_metadata`)
  - chunks serializados
  - `version_number`
  - `snapshot_reason`
  - `chunk_count`
  - `chunk_char_count`

## Flujo
- Ingesta admin con `replace_existing=true`:
  - crea snapshot `pre_ingest_replace`
  - reemplaza chunks
- Borrado admin:
  - crea snapshot `pre_delete`
  - elimina documento activo
- Rollback:
  - crea snapshot `pre_rollback_to_vN`
  - restaura metadata del documento
  - borra chunks activos
  - regenera embeddings e inserta chunks del snapshot

## Endpoint
- `GET /api/admin/rag/documents/[documentId]`
  - lista versiones del documento
- `POST /api/admin/rag/documents/[documentId]`
  - `{ action: "rollback", versionId }`
- `DELETE /api/admin/rag/documents/[documentId]`
  - mantiene snapshot previo antes de borrar

## Nota operativa
- El rollback regenera embeddings, por lo que su latencia depende del modelo de embeddings local.
- No se ha introducido soft delete en tablas activas; el retrieval sigue leyendo solo `rag_documents` y `rag_chunks`.
