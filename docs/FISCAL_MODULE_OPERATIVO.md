# Fiscal Module Operativo

## Alcance
- Workspace fiscal operativo dentro de `/dashboard/fiscal`.
- CRUD basico de `fiscal_alerts` con RLS por usuario.
- Acciones rapidas de estado: `pending`, `resolved`, `ignored`.
- Workflow v2 de tramitacion: `pending`, `prepared`, `presented`, `closed`.
- Workflow v3 con metadatos `tax_regime` y `tax_model`.
- Plantillas recurrentes para obligaciones fiscales futuras.
- Generacion automatizada por job queue.

## Endpoints
- `GET /api/fiscal-alerts`
- `POST /api/fiscal-alerts`
- `PATCH /api/fiscal-alerts/[alertId]`
- `DELETE /api/fiscal-alerts/[alertId]`
- `GET /api/fiscal-templates`
- `POST /api/fiscal-templates`
- `PATCH /api/fiscal-templates/[templateId]`
- `DELETE /api/fiscal-templates/[templateId]`
- `POST /api/fiscal-templates/generate`

## UI
- Formulario unificado para crear y editar alertas.
- Selector de regimen y modelo fiscal en alertas y plantillas.
- Selector de estado de tramitacion en la alerta.
- Formulario de plantillas mensuales, trimestrales y anuales.
- Resumen operativo con Cuota Cero, pendientes, resueltas y vencidas.
- Calendario por periodos con agrupacion visual de obligaciones.
- Resumen agregado por modelos fiscales activos.
- Lista filtrable por estado con scroll interno y acciones directas.
- Acciones directas de tramite: preparar, presentar, cerrar y reabrir tramite.
- Encolado de generacion recurrente y procesado manual de cola desde el modulo.

## Flujo recurrente
- Las plantillas viven en `fiscal_alert_templates`.
- `POST /api/fiscal-templates/generate` crea un `app_job` de tipo `fiscal_template_generation`.
- `POST /api/operations/jobs` procesa la cola del usuario actual.
- El worker genera alertas en `fiscal_alerts` con `template_id`, `period_key` y `source=template`.
- La combinacion `user_id + template_id + period_key` evita duplicados.
- `workflow_status` y `presented_at` permiten separar el tramite de la resolucion final de la alerta.
- `tax_regime` y `tax_model` permiten automatizar y filtrar obligaciones por regimen/modelo.

## Notas de layout
- La pagina mantiene `h-full` y `overflow-hidden` en el shell dashboard.
- El desplazamiento vertical solo ocurre dentro del panel de alertas.
