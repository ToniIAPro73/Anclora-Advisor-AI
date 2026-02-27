# Supabase Env Preflight (Reusable)

Objetivo: bloquear ejecuciones sobre entorno Supabase inconsistente.

Checklist obligatorio:

1. Leer `.env.local` y extraer:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Validar que ambas URLs comparten el mismo `project_ref`.
3. Validar que ambas claves (`anon` y `service_role`) pertenecen al mismo `project_ref`.
4. Confirmar que no hay override conflictivo en variables de proceso (`Process/User/Machine`).
5. Si cualquier validacion falla, detener con:
   - `ENV_MISMATCH=SUPABASE_PROJECT_REF_CONFLICT`
   - `Decision=NO-GO`

Salida requerida:

- `project_ref_activo`
- `env_consistency=ok|fail`
- `detalles_conflicto` (si aplica)

