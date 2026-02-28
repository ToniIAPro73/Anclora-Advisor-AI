# Fiscal Module Operativo

## Alcance
- Workspace fiscal operativo dentro de `/dashboard/fiscal`.
- CRUD basico de `fiscal_alerts` con RLS por usuario.
- Acciones rapidas de estado: `pending`, `resolved`, `ignored`.

## Endpoints
- `GET /api/fiscal-alerts`
- `POST /api/fiscal-alerts`
- `PATCH /api/fiscal-alerts/[alertId]`
- `DELETE /api/fiscal-alerts/[alertId]`

## UI
- Formulario unificado para crear y editar alertas.
- Resumen operativo con Cuota Cero, pendientes, resueltas y vencidas.
- Lista filtrable por estado con scroll interno y acciones directas.

## Notas de layout
- La pagina mantiene `h-full` y `overflow-hidden` en el shell dashboard.
- El desplazamiento vertical solo ocurre dentro del panel de alertas.
