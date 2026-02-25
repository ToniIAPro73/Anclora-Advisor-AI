---
trigger: always_on
---

# Anclora Advisor AI - Project Rules

## Identidad

Aplicacion web de asesoria fiscal, laboral e inmobiliaria con chat inteligente y backend seguro.

## Objetivo operativo

Cada cambio debe proteger simultaneamente:

1. Fiabilidad de respuestas del chat.
2. Seguridad y privacidad de datos.
3. Trazabilidad tecnica y mantenibilidad.
4. Calidad de experiencia de usuario.

## Reglas inmutables

1. No exponer claves o secretos en cliente.
2. Mantener tipado estricto; evitar `any`.
3. Toda feature nueva pasa `lint`, `type-check` y `build`.
4. No romper contrato de `src/app/api/chat/route.ts` sin versionar spec.
5. Actualizar docs cuando cambie arquitectura, datos o flujo del chat.

## Definition of Done por feature

- Spec y test plan actualizados en `sdd/features/<feature>/`.
- Implementacion completa con validaciones.
- Checks de calidad en verde.
- QA report y gate final emitidos.
