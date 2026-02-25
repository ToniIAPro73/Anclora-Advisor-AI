# Agent A (Spec) - chat-response-reliability-and-safety

CONTEXTO:
- Usa `.antigravity/prompts/features/chat-response-reliability-and-safety/feature-chat-response-reliability-and-safety-shared-context.md`.

LECTURAS:
1) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-spec-v1.md`
2) `sdd/features/chat-response-reliability-and-safety/chat-response-reliability-and-safety-test-plan-v1.md`
3) `sdd/core/spec-core-v1.md`

TAREAS:
1) Congelar contrato request/response de `/api/chat`.
2) Definir taxonomia de errores y codigos de estado.
3) Verificar compatibilidad con frontend actual.

ALCANCE PERMITIDO:
- `sdd/features/chat-response-reliability-and-safety/*`
- `sdd/core/*` (solo si hace falta versionar core)

PROHIBIDO:
- `src/*`
- `lib/*`

CRITERIO DE PARADA:
- Spec y test-plan consistentes y listos para implementacion.
