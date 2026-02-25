# Agent C (Frontend) - chat-response-reliability-and-safety

CONTEXTO:
- Usa `.antigravity/prompts/features/chat-response-reliability-and-safety/feature-chat-response-reliability-and-safety-shared-context.md`.
- El contrato API de Agent B queda congelado.

LECTURAS:
1) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-spec-v1.md`
2) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-test-plan-v1.md`

TAREAS:
1) Estados de chat claros y accesibles.
2) Mensajes de error accionables en `es` y `en`.
3) Mantener flujo UX actual sin bloqueos ni regresion visual.

ALCANCE PERMITIDO:
- `src/components/features/*`
- `src/hooks/*`
- `src/app/page.tsx` (solo integracion estricta)
- `sdd/features/chat-response-reliability-and-safety/*` (ajustes UX si imprescindibles)

PROHIBIDO:
- `src/app/api/*`
- `supabase/migrations/*`

CRITERIO DE PARADA:
- UI funcional conectada a backend con estados de error/exito.
