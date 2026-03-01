# E2E UI Tests

## Alcance
- Login real por UI contra Supabase.
- Navegacion autenticada entre `Chat`, `Fiscal`, `Laboral` y `Facturacion`.
- Alta real de factura desde la interfaz.

## Comando
- `npm run test:e2e:ui`

## Infraestructura
- `playwright.config.ts` levanta `Next.js` local automaticamente.
- `scripts/run-next-dev-with-env.mjs` carga `.env.local` antes de arrancar la app.
- `scripts/run-playwright-with-env.mjs` carga `.env.local` antes de ejecutar Playwright.

## Notas operativas
- El test crea un usuario temporal en Supabase Auth y lo elimina al finalizar.
- Los artefactos fallidos quedan en `test-results/` y `playwright-report/`.
- El navegador configurado actualmente es `chromium`.
