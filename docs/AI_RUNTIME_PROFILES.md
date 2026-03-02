# AI Runtime Profiles

## Objetivo

Permitir que Anclora cambie de runtime de IA sin tocar codigo, usando una sola variable de entorno.

## Variable canonica

- `AI_RUNTIME_PROFILE=local`
- `AI_RUNTIME_PROFILE=cloudflare`
- `AI_RUNTIME_PROFILE=groq-cloudflare`

## Perfiles

### `local`

Usa Ollama para chat y embeddings.

Variables minimas:

- `AI_RUNTIME_PROFILE=local`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL_PRIMARY`
- `OLLAMA_MODEL_FALLBACK`
- `OLLAMA_MODEL_FAST`
- `OLLAMA_MODEL_NO_EVIDENCE`
- `OLLAMA_MODEL_GUARD`
- `OLLAMA_EMBED_MODEL`

### `cloudflare`

Usa Cloudflare Workers AI para chat y embeddings.

Variables minimas:

- `AI_RUNTIME_PROFILE=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_MODEL_PRIMARY`
- `CLOUDFLARE_MODEL_FALLBACK`
- `CLOUDFLARE_MODEL_FAST`
- `CLOUDFLARE_MODEL_NO_EVIDENCE`
- `CLOUDFLARE_MODEL_GUARD`
- `CLOUDFLARE_EMBED_MODEL`

### `groq-cloudflare`

Usa Groq para chat y Cloudflare para embeddings.

Variables minimas:

- `AI_RUNTIME_PROFILE=groq-cloudflare`
- `GROQ_API_KEY`
- `GROQ_MODEL_PRIMARY`
- `GROQ_MODEL_FALLBACK`
- `GROQ_MODEL_FAST`
- `GROQ_MODEL_NO_EVIDENCE`
- `GROQ_MODEL_GUARD`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_EMBED_MODEL`

## Compatibilidad de embeddings

El corpus actual del repo esta alineado a `384` dimensiones. Por eso:

- `EMBEDDING_EXPECTED_DIMENSION=384`
- modelo cloud por defecto: `@cf/baai/bge-small-en-v1.5`

Si cambias a un modelo con otra dimension, primero hay que regenerar e reindexar todos los embeddings de `rag_chunks`. Hasta entonces el estado correcto es `NO-GO`.

## Recomendacion para Vercel

Para un primer despliegue gratuito:

- `AI_RUNTIME_PROFILE=groq-cloudflare`
- Groq para chat
- Cloudflare para embeddings

## Recomendacion para VPS futuro

Cuando migres a Hostinger:

1. Mantener Vercel como frontend si quieres.
2. Cambiar a `AI_RUNTIME_PROFILE=local` solo si el backend realmente apunta a un runtime accesible desde el VPS.
3. Si expones Ollama o vLLM desde el VPS, actualiza `OLLAMA_BASE_URL` a la URL remota privada o protegida.
