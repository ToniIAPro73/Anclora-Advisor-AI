---
name: feature-labor-risk-monitor-and-history
description: "Implementacion y QA de ANCLORA-LAB-001 bajo SDD."
---

# Skill - Labor Risk Monitor and History v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-labor-risk-monitor-and-history.md`
4. `sdd/features/labor-risk-monitor-and-history/labor-risk-monitor-and-history-spec-v1.md`
5. `sdd/features/labor-risk-monitor-and-history/labor-risk-monitor-and-history-test-plan-v1.md`

## Metodo de trabajo

1. Congelar shape de `labor_risk_assessments` para UI.
2. Implementar consulta RLS con token de usuario autenticado.
3. Renderizar score actual, recomendaciones e historial.
4. Cerrar con QA/Gate y actualizar changelog/features.

## Checklist

- Datos filtrados por usuario autenticado.
- Score y nivel de riesgo consistentes.
- Historial visible con fechas y estados.
- Estados empty/error claros.
- Checks tecnicos en verde.

