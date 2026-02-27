# labor-risk-monitor-and-history-test-plan-v1

Feature ID: `ANCLORA-LAB-001`

## Scope

- Consulta RLS de `labor_risk_assessments`.
- Render de score y nivel actual.
- Render de recomendaciones e historial.

## Casos funcionales

1. Abrir `/dashboard/laboral` con sesion valida.
2. Ver score actual y nivel de riesgo.
3. Ver recomendaciones de la ultima evaluacion.
4. Ver historial de evaluaciones con fecha.
5. Ver resumen de evaluaciones totales.

## Casos de borde

1. Sin evaluaciones -> mensaje de vacio.
2. Error de consulta -> mensaje de error controlado.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Monitor laboral operativo sin P0/P1 y gate en GO.

