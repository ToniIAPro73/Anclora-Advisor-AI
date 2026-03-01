# CI Pipeline

## Workflow
- Archivo: `.github/workflows/ci.yml`

## Jobs
- `quality`
  - `npm ci`
  - `npm run -s type-check`
  - `npm run -s lint`
  - `npm run -s test:smoke`
  - `npm run -s test:integration:ops`

- `e2e-ui`
  - solo se ejecuta si existen secretos de Supabase en GitHub Actions
  - instala Chromium
  - genera `.env.local`
  - ejecuta `npm run -s test:e2e:ui`

## Secrets requeridos para `e2e-ui`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Criterio
- La calidad base corre siempre.
- El E2E UI no bloquea entornos sin secretos configurados.
