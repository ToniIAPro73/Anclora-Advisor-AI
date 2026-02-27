# i18n-observability-and-release-hardening-test-plan-v1

Feature ID: `ANCLORA-HARD-001`

## Casos

1. `POST /api/chat` responde con header `x-request-id`.
2. `GET/POST /api/invoices` responde con header `x-request-id`.
3. Logs estructurados no exponen claves sensibles.
4. `npm run -s test:i18n` valida paridad `es/en`.
5. `npm run -s test:smoke` valida export de rutas/handlers criticos.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`
- `npm run -s test:i18n`
- `npm run -s test:smoke`

