---
trigger: always_on
---

# Feature Rule - Chat Response Reliability and Safety

Feature ID: `ANCLORA-CRRS-001`

## Alcance v1

- Contrato estable para `POST /api/chat`.
- Manejo de errores y timeout sin fugas internas.
- Estados UX de chat claros para exito y error.
- Observabilidad minima para diagnostico operativo.

## Restricciones

- No romper el flujo principal en `src/app/page.tsx`.
- No introducir secretos o stack traces en respuestas al cliente.
- No degradar accesibilidad basica del chat.
- No cambiar core sin versionar `sdd/core/*`.

## Definition of Done

- Spec y test plan actualizados.
- QA report y gate final emitidos.
- `lint`, `type-check`, `build` en verde.
