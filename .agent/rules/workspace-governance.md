---
trigger: always_on
---

# Workspace Governance - Anclora Advisor AI (SDD)

## Jerarquia normativa

1. `.agent/rules/workspace-governance.md`
2. `.agent/rules/anclora-advisor-ai.md`
3. `AGENTS.md`
4. `sdd/core/constitution-canonical.md`
5. `sdd/core/product-spec-v0.md`
6. `sdd/core/spec-core-v1.md`
7. `sdd/features/<feature>/*`
8. `.agent/skills/**/SKILL.md`
9. `.antigravity/prompts/**`

Si hay conflicto, gana el nivel superior.

## Regla core vs feature

- El core no se altera de forma implicita por una feature.
- Si una feature requiere cambiar core, crear nueva version en `sdd/core/` y registrar en `sdd/core/CHANGELOG.md`.

## Flujo SDD obligatorio

1. Definir spec de feature (`*-spec-v1.md`).
2. Definir plan de pruebas (`*-test-plan-v1.md`).
3. Implementar incrementalmente.
4. Ejecutar `npm run -s lint`, `npm run -s type-check`, `npm run -s build`.
5. Validar `/api/chat` con casos de exito y error.
6. Cerrar con `QA_REPORT_*.md` y `GATE_FINAL_*.md`.

## QA/Gate minimo

- Sin errores P0 en chat UI o navegacion.
- Sin regresion de accesibilidad basica en controles del chat.
- Sin regresion en contrato de `/api/chat`.
- Sin secretos ni datos sensibles en cliente o logs.
