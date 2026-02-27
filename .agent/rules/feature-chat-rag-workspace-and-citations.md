---
trigger: always_on
---

# Feature Rule - Chat RAG Workspace and Citations

Feature ID: `ANCLORA-CHAT-002`

## Alcance v1

- Integrar `ChatInterface` real en `/dashboard/chat`.
- Mostrar citas/fuentes desplegables en respuestas del asistente.
- Mostrar alertas criticas dentro del flujo conversacional.
- Mantener contrato operativo de `/api/chat` para success/error.

## Restricciones

- No romper rutas protegidas del dashboard.
- No exponer secretos ni errores internos en UI.
- Sin degradar accesibilidad basica en input y botones.

## Definition of Done

- Spec y test-plan cerrados.
- Chat integrado y funcional en dashboard.
- QA report y gate final emitidos.
- Checks tecnicos en verde.

