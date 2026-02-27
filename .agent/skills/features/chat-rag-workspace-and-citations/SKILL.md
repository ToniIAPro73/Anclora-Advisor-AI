---
name: feature-chat-rag-workspace-and-citations
description: "Implementacion y QA de ANCLORA-CHAT-002 bajo SDD."
---

# Skill - Chat RAG Workspace and Citations v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-chat-rag-workspace-and-citations.md`
4. `sdd/features/chat-rag-workspace-and-citations/chat-rag-workspace-and-citations-spec-v1.md`
5. `sdd/features/chat-rag-workspace-and-citations/chat-rag-workspace-and-citations-test-plan-v1.md`

## Metodo de trabajo

1. Congelar contrato UI/API del chat para success/error.
2. Implementar chat en `/dashboard/chat`.
3. Renderizar alertas criticas y citas por mensaje.
4. Cerrar con QA + Gate.

## Checklist

- Input envio consulta funcional.
- Mensajes user/assistant renderizados claramente.
- Citas desplegables por respuesta.
- Alertas `CRITICAL` destacadas.
- Checks tecnicos en verde.

