---
trigger: always_on
---

# Feature Rule - Labor Risk Monitor and History

Feature ID: `ANCLORA-LAB-001`

## Alcance v1

- Implementar `/dashboard/laboral` con datos reales de `labor_risk_assessments`.
- Mostrar score de riesgo actual (0.00-1.00) con nivel y barra visual.
- Mostrar recomendaciones de la ultima evaluacion.
- Mostrar historial reciente de evaluaciones.
- Mantener aislamiento por usuario autenticado via RLS.

## Restricciones

- No romper rutas/auth existentes.
- No exponer datos de otros usuarios.
- No exponer secretos en cliente.

## Definition of Done

- Spec/test-plan cerrados.
- Vista laboral conectada a Supabase bajo token de usuario.
- Estados vacio/error contemplados.
- QA report + gate final en GO.
- Checks en verde.

