# auth-session-and-route-guard-spec-v1

Feature ID: `ANCLORA-AUTH-001`

## 1. Problema

La aplicacion no dispone de autenticacion integrada ni proteccion de rutas para el dashboard.

## 2. Objetivo

Garantizar que solo usuarios autenticados acceden a `/dashboard/*` y habilitar flujo login/logout funcional.

## 3. Alcance

- Middleware de proteccion de rutas.
- Pagina `/login` con login y signup.
- Endpoint `/api/auth/session` para sesion de servidor en cookie `httpOnly`.
- Redireccion de `/` segun sesion.
- Shell base de dashboard para validar navegacion protegida.

## 4. No alcance

- Recuperacion de password y OAuth.
- Diseno final premium del dashboard.
- Integracion funcional completa de chat/paneles secundarios.

## 5. Requisitos funcionales

- RF1: Usuario anonimo a `/dashboard/*` -> redireccion a `/login`.
- RF2: Usuario autenticado en `/login` -> redireccion a `/dashboard/chat`.
- RF3: Login correcto crea sesion cliente y cookie de servidor.
- RF4: Logout elimina sesion cliente y cookie de servidor.
- RF5: `/` redirige dinamicamente por estado de sesion.

## 6. Requisitos no funcionales

- RNF1: Sin exponer tokens ni secretos en logs/UI.
- RNF2: Tipado estricto y sin `any` en cambios nuevos.
- RNF3: Compatibilidad con Next.js App Router y middleware.

## 7. Riesgos

- Expiracion de access token sin refresh server-side.
- Desalineacion de variables de entorno entre cliente y servidor.
- Redirecciones ciclicas si middleware/login no coordinan reglas.

## 8. Criterios de aceptacion

- CA1: Flujo login -> dashboard funciona de extremo a extremo.
- CA2: Flujo logout -> login funciona de extremo a extremo.
- CA3: No autenticado no puede acceder a `/dashboard/*`.
- CA4: `lint`, `type-check`, `build` en verde.

## 9. Plan de pruebas

Ver `auth-session-and-route-guard-test-plan-v1.md`.

## 10. Plan de rollout

1. Deploy con variables de entorno validadas.
2. Smoke test manual de login/logout.
3. Monitorizar errores 401/500 en auth API.

