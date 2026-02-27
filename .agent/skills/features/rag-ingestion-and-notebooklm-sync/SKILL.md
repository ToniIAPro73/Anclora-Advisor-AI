---
name: feature-rag-ingestion-and-notebooklm-sync
description: "Infraestructura SDD y prompts Antigravity para ANCLORA-RAG-INGEST-001."
---

# Skill - RAG Ingestion and NotebookLM Sync v1

## Cuando usar

Cuando se necesite ingestar cuadernos de NotebookLM al conocimiento RAG usando MCP.

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-rag-ingestion-and-notebooklm-sync.md`
4. `supabase/migrations/20260225235038_initial_schema.sql`
5. `sdd/features/rag-ingestion-and-notebooklm-sync/rag-ingestion-and-notebooklm-sync-spec-v1.md`
6. `sdd/features/rag-ingestion-and-notebooklm-sync/rag-ingestion-and-notebooklm-sync-test-plan-v1.md`

## Objetivo

Garantizar una ejecucion consistente por Antigravity para:

- leer 3 cuadernos via MCP,
- normalizar y fragmentar contenido,
- generar embeddings 384,
- persistir en `rag_documents` y `rag_chunks`,
- validar grounding y citas en chat.

## Checklist

1. Confirmar inventario de cuadernos (`NOTEBOOK_1..3`) y dominio (`fiscal|laboral|mercado`).
2. Definir mapeo `cuaderno -> rag_documents.category`.
3. Definir chunking (`max_chars`, overlap, metadatos).
4. Definir pipeline embeddings (dim = 384).
5. Definir validaciones QA para retrieval y citas.
6. Emitir `QA_REPORT` y `GATE_FINAL` al terminar ejecucion real.

## Criterios NO-GO

- No se puede acceder a uno o mas cuadernos por MCP.
- Embeddings con dimension distinta de 384.
- Persistencia parcial sin trazabilidad de fuente.
- Contrato de citas no verificable en chat.

