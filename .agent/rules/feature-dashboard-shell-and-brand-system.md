---
trigger: always_on
---

# Feature Rule - Dashboard Shell and Brand System

Feature ID: `ANCLORA-DSH-001`

## Alcance v1

- Consolidar shell de dashboard con sidebar, topbar y area de contenido.
- Integrar identidad visual con `Logo-Advisor.png` y paleta oficial.
- Asegurar comportamiento responsive en desktop y mobile.
- Mantener rutas iniciales de navegacion: chat, fiscal, laboral, facturacion.

## Restricciones

- No romper proteccion de rutas implementada en `ANCLORA-AUTH-001`.
- No introducir secretos o configuracion sensible en cliente.
- No degradar accesibilidad basica de navegacion y controles.

## Definition of Done

- Spec y test-plan cerrados.
- Layout implementado y validado en build.
- QA report y gate final emitidos.
- `FEATURES.md` y `CHANGELOG.md` actualizados.

