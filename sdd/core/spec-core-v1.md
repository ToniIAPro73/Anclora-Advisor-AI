# Spec Core v1

## Contrato base

- Endpoint principal: `POST /api/chat`.
- Entrada valida y tipada.
- Salida consistente para exito y error.

## Reglas de calidad

- `lint`, `type-check`, `build` en verde antes de merge.
- No exponer secretos.
- No romper flujo principal de `src/app/page.tsx`.
