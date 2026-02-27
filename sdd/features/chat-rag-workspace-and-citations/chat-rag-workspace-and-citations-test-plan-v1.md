# chat-rag-workspace-and-citations-test-plan-v1

Feature ID: `ANCLORA-CHAT-002`

## Scope

- Chat UI en `/dashboard/chat`.
- Contrato frontend con `/api/chat`.
- Render de citas y alertas.

## Casos funcionales

1. Enviar consulta valida y recibir respuesta del asistente.
2. Ver mensaje usuario a la derecha y asistente a la izquierda.
3. Expandir detalles/citas de respuesta del asistente.
4. Mostrar tarjeta de alerta cuando `alerts` contiene `CRITICAL`.
5. Mostrar error amigable cuando API responde `success=false`.

## Casos de error

1. `POST /api/chat` sin campos requeridos -> `400`.
2. Simular fallo de API y confirmar feedback de error en UI.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Workspace conversacional estable, sin P0/P1, y gate en GO.

