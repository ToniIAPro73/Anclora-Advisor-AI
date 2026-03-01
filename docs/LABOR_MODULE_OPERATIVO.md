# Labor Module Operativo

## Alcance
- Workspace laboral operativo dentro de `/dashboard/laboral`.
- CRUD basico de `labor_risk_assessments` con RLS por usuario.
- Workflow de mitigacion con acciones persistidas por evaluacion.
- Workflow v2 con responsable asignado, bitacora de seguimiento y cierre operativo.
- Workflow v3 con SLA, checklist estructurado y evidencias enlazadas.
- Evidencias reales en Supabase Storage con descarga firmada y borrado desde UI.

## Endpoints
- `GET /api/labor-risk-assessments`
- `POST /api/labor-risk-assessments`
- `PATCH /api/labor-risk-assessments/[assessmentId]`
- `DELETE /api/labor-risk-assessments/[assessmentId]`
- `POST /api/labor-risk-assessments/[assessmentId]/actions`
- `PATCH /api/labor-mitigation-actions/[actionId]`
- `DELETE /api/labor-mitigation-actions/[actionId]`
- `GET /api/labor-mitigation-actions/[actionId]/evidence`
- `POST /api/labor-mitigation-actions/[actionId]/evidence`
- `DELETE /api/labor-mitigation-actions/[actionId]/evidence`

## UI
- Formulario unificado para crear y editar evaluaciones.
- Preview inmediato de score y nivel de riesgo.
- Seleccion de evaluacion activa.
- Seguimiento de mitigaciones con estados `pending`, `in_progress`, `completed`, `blocked`.
- Gestion de mitigaciones con:
  - responsable (`owner_name`, `owner_email`)
  - notas de seguimiento/evidencias
  - notas de cierre
  - marcas temporales de inicio, ultimo seguimiento y cierre
  - `sla_due_at` para compromiso operativo
  - `checklist_items` para tareas verificables
  - `evidence_links` para referencias externas o documentales
  - subida de ficheros a bucket privado y acceso temporal por URL firmada

## Infraestructura
- Nueva tabla `labor_mitigation_actions`.
- Script de aplicacion: `npm run labor:workflow:apply`.
- Migracion v2: `npm run labor:workflow:v2:apply`.
- Migracion v3: `npm run labor:workflow:v3:apply`.
- Bucket de evidencias: `npm run labor:evidence:storage:apply`.
