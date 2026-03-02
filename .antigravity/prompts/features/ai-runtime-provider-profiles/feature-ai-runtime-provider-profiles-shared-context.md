# Shared Context - ai-runtime-provider-profiles

Feature ID: `ANCLORA-AI-001`

- Variable de seleccion: `AI_RUNTIME_PROFILE`
- Perfiles v1: `local`, `cloudflare`, `groq-cloudflare`
- Restriccion critica: la dimension de embeddings debe seguir alineada con el corpus indexado (`EMBEDDING_EXPECTED_DIMENSION=384` por defecto)
- No romper `/api/chat`, `/api/chat/stream` ni retrieval RAG actual
