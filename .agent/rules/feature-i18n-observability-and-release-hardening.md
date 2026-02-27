---
trigger: always_on
---

# Feature Rule - i18n Observability and Release Hardening

Feature ID: `ANCLORA-HARD-001`

## Alcance v1

- Validacion i18n `es/en` para mensajes backend nuevos.
- Logging estructurado con `request_id` y redaccion basica de datos sensibles.
- Smoke test automatizado de rutas principales y handlers API.
- Checklist final de release.

## Restricciones

- No loggear PII en claro (email, token, password).
- Mantener contrato existente de `/api/chat`.
- Mantener dashboard sin scroll vertical global.

## Definition of Done

- Tests `test:i18n` y `test:smoke` en PASS.
- `lint`, `type-check`, `build` en PASS.
- QA y Gate final en GO.

