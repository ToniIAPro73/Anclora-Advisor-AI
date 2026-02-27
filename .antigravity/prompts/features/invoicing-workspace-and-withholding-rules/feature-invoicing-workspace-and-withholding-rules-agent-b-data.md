# Agent B - Data/API

Implementar:

- `GET /api/invoices` (listado por usuario autenticado).
- `POST /api/invoices` (alta de borrador con calculo server-side).
- Validacion de payload con schema estricto.

Reglas:

- No aceptar `user_id` desde cliente.
- Respetar RLS y sesion por cookie.

