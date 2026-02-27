# labor-risk-monitor-and-history-spec-v1

Feature ID: `ANCLORA-LAB-001`

## 1. Problema

El dashboard laboral estaba en modo placeholder y no mostraba evaluaciones reales de riesgo.

## 2. Objetivo

Entregar una vista laboral funcional con score de riesgo, recomendaciones y trazabilidad historica usando `labor_risk_assessments`.

## 3. Alcance

- Consulta real de `labor_risk_assessments` bajo RLS.
- Tarjeta de score y nivel de riesgo de la ultima evaluacion.
- Lista de recomendaciones de la ultima evaluacion.
- Historial reciente de evaluaciones.
- Estados vacio/error.

## 4. No alcance

- Alta/edicion de evaluaciones desde UI.
- Motor de scoring.
- Automatizacion de alertas.

## 5. Requisitos funcionales

- RF1: Cargar evaluaciones laborales del usuario autenticado.
- RF2: Mostrar score actual normalizado (0-100%).
- RF3: Mostrar nivel de riesgo por evaluacion.
- RF4: Mostrar recomendaciones de la ultima evaluacion.
- RF5: Mostrar historial reciente y estado vacio/error.

## 6. Requisitos no funcionales

- RNF1: Preservar RLS por usuario.
- RNF2: No exponer secretos ni stack traces en UI.
- RNF3: Render estable en desktop/mobile.

## 7. Riesgos

- Usuarios sin datos de evaluacion.
- Inconsistencia semantica en `risk_level` historico.

## 8. Criterios de aceptacion

- CA1: `/dashboard/laboral` renderiza datos reales de `labor_risk_assessments`.
- CA2: Score/nivel/recomendaciones/historial visibles.
- CA3: Checks tecnicos en verde.

## 9. Plan de pruebas

Ver `labor-risk-monitor-and-history-test-plan-v1.md`.

## 10. Plan de rollout

1. Deploy frontend.
2. Smoke test de `/dashboard/laboral` con sesion autenticada.
3. Continuar con `ANCLORA-INV-001`.

