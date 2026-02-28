# Deployment Cron

## Objetivo
- Procesar `app_jobs` de forma automatica en despliegue.

## Vercel
- El repo incluye [vercel.json](c:\Users\Usuario\Workspace\01_Proyectos\anclora-advisor-ai\vercel.json) con cron cada 5 minutos sobre `/api/internal/jobs/process`.
- Configurar en el entorno:
  - `CRON_SECRET`
  - opcionalmente `APP_JOBS_CRON_SECRET` si quieres un secreto explicito distinto fuera de Vercel

## Seguridad
- El endpoint acepta:
  - `Authorization: Bearer <secret>`
  - `x-app-jobs-secret: <secret>`
- En Vercel Cron, `CRON_SECRET` se envia automaticamente como bearer token.

## Resultado esperado
- La cola deja de depender de clicks manuales en dashboard o ejecucion de `npm run ops:process`.
