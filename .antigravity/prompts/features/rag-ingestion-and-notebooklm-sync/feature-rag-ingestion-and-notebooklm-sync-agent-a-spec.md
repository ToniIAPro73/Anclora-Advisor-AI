# Agent A (Spec) - rag-ingestion-and-notebooklm-sync

Objetivo: congelar contratos antes de implementacion.

Tareas:

1. Definir mapping exacto:
   - `NOTEBOOK_1_ID` -> dominio/category
   - `NOTEBOOK_2_ID` -> dominio/category
   - `NOTEBOOK_3_ID` -> dominio/category
2. Definir estrategia de chunking:
   - `max_chars`
   - `overlap_chars`
   - limpieza y deduplicacion
3. Definir contrato minimo de metadatos por chunk:
   - `document_id`
   - `source_title`
   - `source_url` o `notebook_ref`
   - `domain`
   - `ingested_at`
4. Definir acceptance tests para retrieval y citas.

Salida esperada:

- Spec y test-plan listos para implementacion.

