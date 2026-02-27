# Master Parallel - auth-session-and-route-guard

Feature ID: `ANCLORA-AUTH-001`

Usar contexto comun:
- `.antigravity/prompts/features/auth-session-and-route-guard/feature-auth-session-and-route-guard-shared-context.md`
- Baselines globales de feature y QA.

## Agentes
- Agent A: spec y contrato de sesion.
- Agent B: middleware + API de sesion.
- Agent C: login/dashboard UX.
- Agent D: QA y gate final.

## Orden
1. Agent A
2. Agent B + Agent C
3. Agent D
4. Gate final

