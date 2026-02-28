# Chat History Persisted

## Alcance
- Conversaciones persistidas en `conversations`.
- Mensajes persistidos en `messages` y rehidratados al cargar `/dashboard/chat`.
- Cambio de conversacion y creacion de nueva conversacion desde la UI.

## Endpoints
- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `GET /api/chat/conversations/[conversationId]`
- `PATCH /api/chat/conversations/[conversationId]`

## Cambios de runtime
- El orquestador ya guarda mensaje de usuario y de asistente.
- Si la conversacion no existe, se crea antes de persistir mensajes.
- La UI ya no usa un `conversationId` sintetico no persistible.

## Limite actual
- No hay renombrado manual de conversaciones.
- El titulo se deriva automaticamente de la consulta inicial.

