# SKILL: Spec Driven Feature Delivery

## Cuando usar

Para cualquier feature nueva o refactor que impacte comportamiento de negocio.

## Objetivo

Aplicar flujo SDD: spec -> test plan -> implementacion -> QA -> gate.

## Checklist

1. Revisar reglas de `.agent/rules/` y core en `sdd/core/`.
2. Crear/actualizar `*-spec-v1.md`.
3. Crear/actualizar `*-test-plan-v1.md`.
4. Implementar cambios minimos y seguros.
5. Ejecutar `lint`, `type-check`, `build`.
6. Emitir `QA_REPORT` y `GATE_FINAL`.
