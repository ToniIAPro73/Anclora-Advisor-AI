# ADMIN-RBAC-001

## Objetivo
- Canonicalizar roles de aplicacion en `users.role`: `admin | partner | user`.
- Garantizar fila en `users` al sincronizar sesion Supabase.
- Restringir `/dashboard/admin/*` y `/api/admin/*` a usuarios con rol `admin`.

## Implementacion
- `src/app/api/auth/session/route.ts`: sincroniza/crea `users` al guardar la sesion.
- `src/lib/auth/app-user.ts`: helper server-side para cargar y mantener el usuario de aplicacion.
- `src/lib/auth/roles.ts`: normalizacion de roles.
- `src/middleware.ts`: bloqueo temprano de `/dashboard/admin/*`.
- `src/app/dashboard/admin/page.tsx`: superficie admin minima de verificacion.
- `src/app/api/admin/rag/status/route.ts`: endpoint protegido de estado RAG.

## Base de datos
- Migracion: `supabase/migrations/20260228_admin_rbac_roles.sql`
- Normaliza roles legacy a `user`.
- Default de `users.role` pasa a `user`.
- Constraint de valores permitidos.
- Policy `users_self_read_policy` para leer el propio rol desde middleware via REST.
