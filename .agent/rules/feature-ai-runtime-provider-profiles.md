---
trigger: always_on
---

# Feature Rule - AI Runtime Provider Profiles

Feature ID: `ANCLORA-AI-001`

## Alcance v1

- Mantener compatibilidad total con perfil local basado en Ollama.
- Agregar perfiles cloud seleccionables por una sola variable de entorno.
- Habilitar `cloudflare` y `groq-cloudflare` para chat y embeddings.
- Evitar roturas del contrato actual de `/api/chat` y retrieval.

## Restricciones

- `AI_RUNTIME_PROFILE` es la fuente de verdad del runtime activo.
- No romper el flujo local existente cuando `AI_RUNTIME_PROFILE=local`.
- Si el proveedor de embeddings no coincide en dimension con el corpus indexado, estado obligatorio: `Decision=NO-GO`.
- No usar `localhost` en despliegue cloud salvo perfil `local`.
- No exponer secretos de Groq o Cloudflare al cliente.

## Definition of Done

- Selector de runtime implementado con perfiles `local | cloudflare | groq-cloudflare`.
- `lib/agents/orchestrator.ts` y `src/lib/rag/embeddings.ts` consumen la nueva capa.
- `.env.example` y `docs/AI_RUNTIME_PROFILES.md` actualizados.
- Artefactos SDD completos (`rule`, `skill`, `prompts`, `spec`, `test-plan`, `QA_REPORT`, `GATE_FINAL`).
