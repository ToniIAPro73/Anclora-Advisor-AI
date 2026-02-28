# Operations Queue

## Alcance
- Cola operativa reutilizable para `app_jobs` y `email_outbox`.
- Procesado manual por usuario desde UI/API.
- Procesado interno para todos los usuarios mediante endpoint protegido por secreto.

## Endpoints
- `GET /api/operations/jobs`
- `POST /api/operations/jobs`
- `POST /api/internal/jobs/process`

## Cron / worker
- Configurar `APP_JOBS_CRON_SECRET` en servidor.
- Invocar `POST /api/internal/jobs/process` con:
  - cabecera `x-app-jobs-secret: <secret>` o
  - `Authorization: Bearer <secret>`
- El endpoint procesa usuarios con jobs `pending` cuyo `run_after` ya vencio.

## Scripts
- `npm run ops:apply`
- `npm run ops:process`

## Uso recomendado
- En desarrollo: `npm run ops:process`
- En produccion: cron externo o scheduler que llame `POST /api/internal/jobs/process` cada 1-5 minutos
