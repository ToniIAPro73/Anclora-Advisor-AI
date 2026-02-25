# Agent D (QA) - chat-response-reliability-and-safety

TAREAS:
0) Validacion de entorno (obligatoria):
- Leer `.env.local` y `.env.example`.
- Verificar que no hay referencias hardcodeadas a secretos/project refs.
- Si hay mismatch o dudas: reportar `ENV_MISMATCH`.

1) Validar contrato `/api/chat` en happy/error paths.
2) Validar timeout, errores y mensajes al usuario.
3) Validar i18n de textos nuevos/modificados en `es` y `en`.
4) Ejecutar checks:
- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`
5) Validar limpieza de artefactos temporales de pruebas.

SALIDA:
- Reporte QA con:
  - entorno validado (si/no)
  - tests ejecutados
  - evidencias
  - defectos P0/P1/P2
  - `I18N_MISSING_KEYS` (si aplica)
  - `ENV_MISMATCH` (si aplica)
  - decision previa al gate
