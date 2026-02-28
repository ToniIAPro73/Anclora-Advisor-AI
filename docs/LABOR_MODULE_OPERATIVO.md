# Labor Module Operativo

## Alcance
- Workspace laboral operativo dentro de `/dashboard/laboral`.
- CRUD basico de `labor_risk_assessments` con RLS por usuario.
- Workflow de mitigacion con acciones persistidas por evaluacion.

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

## Infraestructura
- Nueva tabla `labor_mitigation_actions`.
- Script de aplicacion: `npm run labor:workflow:apply`.
