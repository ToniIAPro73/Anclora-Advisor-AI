# ai-runtime-provider-profiles-test-plan-v1

## Objetivo

Validar que el runtime de IA cambia de perfil por variable de entorno sin romper el contrato actual de chat ni la compatibilidad del RAG.

## Casos

### T1. Perfil local

- Precondicion: `AI_RUNTIME_PROFILE=local`
- Verificar que la resolucion de runtime devuelve `ollama` para chat y embeddings.

### T2. Perfil cloudflare

- Precondicion: `AI_RUNTIME_PROFILE=cloudflare`
- Verificar resolucion de base URL, token y modelos sin variables publicas.

### T3. Perfil groq-cloudflare

- Precondicion: `AI_RUNTIME_PROFILE=groq-cloudflare`
- Verificar `groq` para chat y `cloudflare` para embeddings.

### T4. Perfil invalido

- Verificar que el runtime falla de forma explicita ante un valor no soportado.

### T5. Proteccion de dimension

- Verificar que `generateEmbedding` rechaza dimensiones distintas a `EMBEDDING_EXPECTED_DIMENSION`.

### T6. Contrato `/api/chat`

- Verificar export de rutas y tipado correcto tras integrar el nuevo runtime.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`
- `npm run -s test:ai-runtime-profile`

## Criterio de salida

- Local sin regresion.
- Perfiles cloud documentados y type-safe.
- Sin P0/P1.
- Gate solo en `GO` si hay evidencia real de ejecucion del perfil cloud objetivo.
