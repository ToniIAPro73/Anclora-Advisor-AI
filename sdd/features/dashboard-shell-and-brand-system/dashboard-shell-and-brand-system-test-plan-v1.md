# dashboard-shell-and-brand-system-test-plan-v1

Feature ID: `ANCLORA-DSH-001`

## Scope

- Tokens visuales globales.
- Sidebar + topbar + main content.
- Rutas base del dashboard.

## Casos funcionales

1. Abrir `/dashboard/chat` con sesion y verificar shell completo.
2. Navegar a `/dashboard/fiscal`, `/dashboard/laboral`, `/dashboard/facturacion`.
3. Confirmar estado activo del enlace en sidebar.
4. Confirmar topbar contextual segun ruta.
5. Ejecutar logout desde sidebar y validar redireccion a `/login`.

## Casos responsive

1. Verificar layout en viewport mobile (sidebar apilado superior).
2. Verificar layout en viewport desktop (sidebar lateral fijo).
3. Confirmar legibilidad de textos y botones en ambos escenarios.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Shell operativo y consistente con marca, sin P0/P1 abiertos.

