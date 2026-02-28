# Labor Module Operativo

## Alcance
- Workspace laboral operativo dentro de `/dashboard/laboral`.
- CRUD basico de `labor_risk_assessments` con RLS por usuario.
- Workflow de mitigacion con acciones persistidas por evaluacion.
- Workflow v2 con responsable asignado, bitacora de seguimiento y cierre operativo.

## Endpoints
- `GET /api/labor-risk-assessments`
- `POST /api/labor-risk-assessments`
- `PATCH /api/labor-risk-assessments/[assessmentId]`
- `DELETE /api/labor-risk-assessments/[assessmentId]`
- `POST /api/labor-risk-assessments/[assessmentId]/actions`
- `PATCH /api/labor-mitigation-actions/[actionId]`
- `DELETE /api/labor-mitigation-actions/[actionId]`

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

## Infraestructura
- Nueva tabla `labor_mitigation_actions`.
- Script de aplicacion: `npm run labor:workflow:apply`.
- Migracion v2: `npm run labor:workflow:v2:apply`.
