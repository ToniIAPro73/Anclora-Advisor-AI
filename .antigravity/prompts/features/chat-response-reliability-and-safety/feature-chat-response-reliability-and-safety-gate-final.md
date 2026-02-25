# Gate Final - chat-response-reliability-and-safety

PROMPT: Ejecuta gate final de release para `ANCLORA-CRRS-001`.

PRECONDICIONES:
- QA completado con validacion de entorno.
- `I18N_MISSING_KEYS` = none.
- `ENV_MISMATCH` = none.

GATES OBLIGATORIOS:
1. Contrato de chat estable.
2. Errores controlados y comprensibles.
3. Checks tecnicos en verde.
4. Sin fuga de datos sensibles.
5. SDD actualizado (index/spec/test-plan/qa/gate).

SALIDA:
- Decision GO / NO-GO.
- Si NO-GO: fixes priorizados.
- Si GO: plan de despliegue y rollback.
