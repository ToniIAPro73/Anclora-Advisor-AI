---
trigger: always_on
---

# Feature Rule - RAG Ingestion and NotebookLM Sync

Feature ID: `ANCLORA-RAG-INGEST-001`

## Alcance v1

- Definir flujo de ingesta de 3 cuadernos de NotebookLM hacia `rag_documents` y `rag_chunks`.
- Diseñar proceso con MCP para acceso a cuadernos y extraccion de conocimiento.
- Establecer contrato de chunking, embeddings y trazabilidad de fuentes.
- Preparar prompts para ejecucion por agentes Antigravity.

## Restricciones

- No ejecutar implementacion runtime en esta fase.
- No insertar secretos hardcodeados en prompts o docs.
- Mantener cumplimiento RLS y politicas de seguridad del workspace.

## Definition of Done

- Rule/Skill/Prompts completos para ejecucion por Antigravity.
- Spec y test-plan de la feature creados.
- Gate y QA en estado PENDING hasta ejecucion real.

