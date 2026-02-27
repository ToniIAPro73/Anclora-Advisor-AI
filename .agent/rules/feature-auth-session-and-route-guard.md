---
trigger: always_on
---

# Feature Rule - Auth Session and Route Guard

Feature ID: `ANCLORA-AUTH-001`

## Alcance v1

- Proteger `/dashboard/*` con middleware y validacion de sesion Supabase.
- Implementar `/login` con login/signup.
- Sincronizar sesion cliente->servidor via cookie `httpOnly`.
- Redireccion de `/` segun sesion activa.

## Restricciones

- No exponer secretos ni tokens en cliente.
- No romper contrato existente de `/api/chat`.
- Mantener tipado estricto y sin `any`.
- Mantener integridad del flujo App Router.

## Definition of Done

- Spec y test-plan cerrados.
- Implementacion funcional de login/logout y guard de rutas.
- `lint`, `type-check`, `build` en verde.
- QA report y Gate final emitidos.

