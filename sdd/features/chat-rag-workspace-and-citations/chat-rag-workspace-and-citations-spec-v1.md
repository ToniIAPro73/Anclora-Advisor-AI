# chat-rag-workspace-and-citations-spec-v1

Feature ID: `ANCLORA-CHAT-002`

## 1. Problema

El dashboard tenia shell visual, pero sin experiencia conversacional real integrada.

## 2. Objetivo

Habilitar un workspace de chat funcional en `/dashboard/chat` con evidencia de fuentes y alertas de riesgo.

## 3. Alcance

- Integracion de `ChatInterface` en ruta de dashboard.
- Render de mensajes user/assistant.
- Visualizacion de citas y alertas criticas.
- Manejo claro de estado loading/error.

## 4. No alcance

- Persistencia historica avanzada de conversaciones.
- Soporte streaming y multi-turn con contexto enriquecido.
- Internacionalizacion completa `es/en`.

## 5. Requisitos funcionales

- RF1: El usuario puede enviar consulta desde `/dashboard/chat`.
- RF2: La respuesta del asistente renderiza contenido + metadatos.
- RF3: Citas se muestran en bloque expandible.
- RF4: Alertas `CRITICAL` se muestran destacadas.
- RF5: Error path del API se muestra de forma segura.

## 6. Requisitos no funcionales

- RNF1: No romper contrato base de `/api/chat`.
- RNF2: Sin exponer stack traces ni secretos.
- RNF3: Compatibilidad responsive de chat en dashboard.

## 7. Riesgos

- Inconsistencia de contrato cuando `citations` o `alerts` faltan.
- Mensajes largos que rompan layout en mobile.

## 8. Criterios de aceptacion

- CA1: Chat operativo end-to-end en dashboard.
- CA2: Citas y alertas visibles en respuestas.
- CA3: Checks en verde.

## 9. Plan de pruebas

Ver `chat-rag-workspace-and-citations-test-plan-v1.md`.

## 10. Plan de rollout

1. Deploy de frontend con smoke test de `/dashboard/chat`.
2. Verificar success/error path contra `/api/chat`.
3. Continuar con `ANCLORA-FISC-001`.

