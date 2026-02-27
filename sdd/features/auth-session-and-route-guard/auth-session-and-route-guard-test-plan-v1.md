# auth-session-and-route-guard-test-plan-v1

Feature ID: `ANCLORA-AUTH-001`

## Scope

- Middleware de proteccion de rutas.
- Login/signup y sincronizacion de sesion server.
- Logout y redirecciones.

## Casos funcionales

1. Usuario anonimo visita `/dashboard/chat` -> redireccionado a `/login?next=/dashboard/chat`.
2. Usuario autenticado visita `/login` -> redireccionado a `/dashboard/chat`.
3. Login valido -> cookie de sesion creada + acceso dashboard.
4. Login invalido -> mensaje de error sin fuga sensible.
5. Logout -> cookie eliminada + redireccion a `/login`.
6. `/` con sesion -> `/dashboard/chat`; sin sesion -> `/login`.

## Casos de error

1. `POST /api/auth/session` sin payload valido -> `400`.
2. `POST /api/auth/session` con token invalido -> `401`.
3. `GET /api/auth/session` sin sesion -> `401`.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Todos los casos funcionales y checks tecnicos en verde, sin P0/P1 abiertos.

