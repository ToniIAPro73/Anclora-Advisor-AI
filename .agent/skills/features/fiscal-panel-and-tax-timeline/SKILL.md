---
name: feature-fiscal-panel-and-tax-timeline
description: "Implementacion y QA de ANCLORA-FISC-001 bajo SDD."
---

# Skill - Fiscal Panel and Tax Timeline v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-fiscal-panel-and-tax-timeline.md`
4. `sdd/features/fiscal-panel-and-tax-timeline/fiscal-panel-and-tax-timeline-spec-v1.md`
5. `sdd/features/fiscal-panel-and-tax-timeline/fiscal-panel-and-tax-timeline-test-plan-v1.md`

## Metodo de trabajo

1. Congelar shape de datos fiscales para UI.
2. Implementar consulta RLS con token de usuario.
3. Renderizar widget Cuota Cero + timeline IVA/IRPF.
4. Cerrar con QA/Gate.

## Checklist

- Datos filtrados por usuario autenticado.
- Estados loading/empty/error claros.
- Cuota Cero y timeline visibles.
- Checks tecnicos en verde.

