---
name: feature-i18n-observability-and-release-hardening
description: "Implementacion y QA de ANCLORA-HARD-001 bajo SDD."
---

# Skill - i18n Observability and Release Hardening v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-i18n-observability-and-release-hardening.md`
4. `sdd/features/i18n-observability-and-release-hardening/i18n-observability-and-release-hardening-spec-v1.md`
5. `sdd/features/i18n-observability-and-release-hardening/i18n-observability-and-release-hardening-test-plan-v1.md`

## Metodo de trabajo

1. Introducir logger estructurado con `request_id` en APIs criticas.
2. Introducir diccionario i18n y validacion de claves `es/en`.
3. Ejecutar smoke test de rutas/handlers criticos.
4. Cerrar QA/Gate con checklist de release.

