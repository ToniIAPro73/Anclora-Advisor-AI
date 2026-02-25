PROMPT: Orquesta la implementacion de una feature en modo controlado y por agentes.

PASOS:
1) Ejecutar Agent A (spec/db) y detener.
2) Revisar diff y contrato resultante.
3) Ejecutar Agent B (backend) y Agent C (frontend) en paralelo.
4) Ejecutar Agent D (QA).
5) Ejecutar gate final.

REGLAS:
- No saltar el orden.
- Cada agente para al completar su alcance.
- 1 prompt = 1 commit.
- Referenciar siempre `_feature-delivery-baseline.md` y `_qa-gate-baseline.md`.
