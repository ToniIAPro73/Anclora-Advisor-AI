# Agent B (Backend) - chat-response-reliability-and-safety

CONTEXTO:
- Usa `.antigravity/prompts/features/chat-response-reliability-and-safety/feature-chat-response-reliability-and-safety-shared-context.md`.
- El contrato de Agent A queda congelado.

LECTURAS:
1) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-spec-v1.md`
2) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-test-plan-v1.md`

TAREAS:
1) Validacion de entrada robusta para `/api/chat`.
2) Manejo de timeout y errores tipados.
3) Logging minimo sin datos sensibles.
4) Cobertura minima de casos de exito/error en tests de API.

ALCANCE PERMITIDO:
- `src/app/api/chat/*`
- `lib/agents/*`
- `tests/*`
- `sdd/features/chat-response-reliability-and-safety/*` (ajustes de contrato API si imprescindible)

PROHIBIDO:
- `src/components/*`
- `supabase/migrations/*` (excepto cambios estrictamente requeridos por contrato)

CRITERIO DE PARADA:
- Backend compila, rutas responden y pruebas de contrato basicas pasan.
