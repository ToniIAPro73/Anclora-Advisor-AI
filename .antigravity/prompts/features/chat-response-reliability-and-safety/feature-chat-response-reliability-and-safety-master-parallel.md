# Master Parallel - chat-response-reliability-and-safety

Feature ID: `ANCLORA-CRRS-001`

Usar contexto comun:
- `.antigravity/prompts/features/chat-response-reliability-and-safety/feature-chat-response-reliability-and-safety-shared-context.md`
- Baselines: `.antigravity/prompts/features/_feature-delivery-baseline.md` y `.antigravity/prompts/features/_qa-gate-baseline.md`

## Agentes
- Agent A: spec y contratos.
- Agent B: backend/API.
- Agent C: frontend UX.
- Agent D: QA y gate final.

## Orden de ejecucion
1) Agent A.
2) Agent B + Agent C (en paralelo tras Agent A).
3) Agent D.
4) Gate final.

## Politica de parada
- 1 prompt = 1 commit.
- Cada agente se detiene al completar su bloque.
