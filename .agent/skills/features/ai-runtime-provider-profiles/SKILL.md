---
name: feature-ai-runtime-provider-profiles
description: "Implementacion y QA de ANCLORA-AI-001 para conmutar runtimes de IA local y cloud por perfil."
---

# Skill - AI Runtime Provider Profiles v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-ai-runtime-provider-profiles.md`
4. `docs/AI_RUNTIME_PROFILES.md`
5. `sdd/features/ai-runtime-provider-profiles/ai-runtime-provider-profiles-spec-v1.md`
6. `sdd/features/ai-runtime-provider-profiles/ai-runtime-provider-profiles-test-plan-v1.md`

## Metodo de trabajo

1. Centralizar la resolucion de perfil y proveedores en una capa server-only reutilizable.
2. Reapuntar chat/orchestrator y embeddings a esa capa sin cambiar el contrato publico.
3. Mantener defaults locales y agregar perfiles cloud sin hardcodear secretos.
4. Validar dimension de embeddings contra el corpus indexado.
5. Cerrar con QA/Gate y actualizar `sdd/core/CHANGELOG.md` y `sdd/features/FEATURES.md`.

## Checklist

- Perfil `local` sigue funcionando sin nuevas credenciales.
- Perfil `cloudflare` resuelve chat y embeddings desde el mismo account.
- Perfil `groq-cloudflare` usa Groq para chat y Cloudflare para embeddings.
- `EMBEDDING_EXPECTED_DIMENSION` protege contra incompatibilidades de retrieval.
- Los checks tecnicos y las pruebas unitarias nuevas quedan documentados en QA.
