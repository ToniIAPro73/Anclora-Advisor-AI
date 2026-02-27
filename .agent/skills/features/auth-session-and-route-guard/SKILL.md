---
name: feature-auth-session-and-route-guard
description: "Implementacion y QA de ANCLORA-AUTH-001 bajo SDD."
---

# Skill - Auth Session and Route Guard v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-auth-session-and-route-guard.md`
4. `sdd/features/auth-session-and-route-guard/auth-session-and-route-guard-INDEX.md`
5. `sdd/features/auth-session-and-route-guard/auth-session-and-route-guard-spec-v1.md`
6. `sdd/features/auth-session-and-route-guard/auth-session-and-route-guard-test-plan-v1.md`

## Metodo de trabajo

1. Congelar flujo de sesion y reglas de redireccion.
2. Implementar por capas: middleware -> auth API -> login UI -> dashboard guard.
3. Verificar seguridad minima del manejo de tokens.
4. Cerrar con QA report, Gate final y evidencias tecnicas.

## Checklist

- Middleware bloquea acceso anonimo a `/dashboard/*`.
- Login crea sesion de servidor.
- Logout elimina sesion cliente y cookie.
- `/` redirige a `/login` o `/dashboard/chat` segun sesion.
- Checks tecnicos en verde.

