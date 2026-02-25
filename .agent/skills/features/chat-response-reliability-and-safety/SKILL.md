---
name: feature-chat-response-reliability-and-safety
description: "Implementacion y QA de ANCLORA-CRRS-001 bajo SDD."
---

# Skill - Chat Response Reliability and Safety v1

## Lecturas obligatorias
1) `AGENTS.md`
2) `.agent/rules/workspace-governance.md`
3) `.agent/rules/feature-chat-response-reliability-and-safety.md`
4) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-INDEX.md`
5) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-spec-v1.md`
6) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-test-plan-v1.md`

## Metodo de trabajo
1. Congelar contrato API antes de codificar.
2. Implementar por capas: spec -> backend -> frontend -> QA.
3. Mantener trazabilidad de errores sin exponer detalles sensibles.
4. Entregar checklist final de verificaciones y riesgos residuales.

## Backend
- Validacion estricta del payload.
- Respuestas tipadas de exito/error.
- Timeout y control de reintentos.
- Logging seguro sin PII.

## Frontend
- Estados `idle/loading/success/error` claros.
- Mensajes accionables en `es` y `en`.
- Sin romper UX existente.

## QA minimo
- Contract tests de `/api/chat`.
- Casos de timeout y fallos controlados.
- `lint`, `type-check`, `build`.
- Verificacion de no-regresion en UI principal.
