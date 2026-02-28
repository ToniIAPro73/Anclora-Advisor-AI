# Labor Module Operativo

## Alcance
- Workspace laboral operativo dentro de `/dashboard/laboral`.
- CRUD basico de `labor_risk_assessments` con RLS por usuario.
- Gestion de escenario, `risk_score`, `risk_level` y recomendaciones editables.

## Endpoints
- `GET /api/labor-risk-assessments`
- `POST /api/labor-risk-assessments`
- `PATCH /api/labor-risk-assessments/[assessmentId]`
- `DELETE /api/labor-risk-assessments/[assessmentId]`

## UI
- Formulario unificado para crear y editar evaluaciones.
- Preview inmediato de score y nivel de riesgo.
- Historial con recomendaciones y acciones directas.

## Limite actual
- La tabla actual no tiene `status`, `owner`, `mitigation_due_date` ni trazabilidad de seguimiento.
- Si quieres workflow completo de mitigacion y cierre, hace falta ampliar esquema con migracion.
