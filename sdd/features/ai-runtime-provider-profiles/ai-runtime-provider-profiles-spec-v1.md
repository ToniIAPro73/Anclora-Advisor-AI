# ai-runtime-provider-profiles-spec-v1

Feature ID: `ANCLORA-AI-001`

## 1. Problema

El runtime actual de chat y embeddings depende de Ollama local, lo que bloquea despliegues serverless en Vercel y dificulta probar proveedores cloud sin refactor.

## 2. Objetivo

Introducir perfiles de runtime de IA seleccionables por una sola variable de entorno, preservando el modo local e incorporando perfiles cloud compatibles con despliegue en Vercel.

## 3. Alcance

- Selector de runtime por `AI_RUNTIME_PROFILE`.
- Perfil `local` basado en Ollama.
- Perfil `cloudflare` para chat + embeddings.
- Perfil `groq-cloudflare` para chat Groq + embeddings Cloudflare.
- Integracion del selector en orchestrator y generacion de embeddings.
- Documentacion operativa de variables para local, Vercel y futura migracion a VPS.

## 4. No alcance

- Reindexacion completa del corpus a otra dimension de embeddings.
- UI nueva de administracion del proveedor activo.
- Sustitucion de Supabase o rediseño del orquestador.
- Failover automatico entre perfiles distintos.

## 5. Requisitos funcionales

- RF1: `AI_RUNTIME_PROFILE=local` debe mantener el flujo actual de Ollama.
- RF2: `AI_RUNTIME_PROFILE=cloudflare` debe resolver chat y embeddings desde Cloudflare con API token server-side.
- RF3: `AI_RUNTIME_PROFILE=groq-cloudflare` debe usar Groq para chat y Cloudflare para embeddings.
- RF4: Las rutas `/api/chat` y `/api/chat/stream` mantienen contrato de request/response.
- RF5: Retrieval debe rechazar embeddings cuya dimension no coincida con `EMBEDDING_EXPECTED_DIMENSION`.
- RF6: `.env.example` debe documentar las variables minimas por perfil.

## 6. Requisitos no funcionales

- RNF1: Ninguna credencial cloud se expone como `NEXT_PUBLIC_*`.
- RNF2: El cambio de perfil no requiere cambios de codigo.
- RNF3: Los defaults de perfil local siguen siendo funcionales en desarrollo.
- RNF4: El perfil cloud por defecto debe ser deterministicamente derivable desde variables de entorno.

## 7. Riesgos

- Incompatibilidad entre embedding model y corpus indexado.
- Configuracion incompleta de credenciales cloud en Vercel.
- Suposicion incorrecta de compatibilidad OpenAI entre proveedores.

## 8. Criterios de aceptacion

- CA1: Existe una capa centralizada de runtime IA reutilizable.
- CA2: Orchestrator y embeddings usan esa capa.
- CA3: El perfil local no regresa.
- CA4: El repo incluye artefactos SDD completos de la feature.
- CA5: QA explicita si el gate queda en GO o NO-GO segun evidencia real.

## 9. Decision tecnica v1

- Variable canonica: `AI_RUNTIME_PROFILE`
- Valores soportados:
  - `local`
  - `cloudflare`
  - `groq-cloudflare`
- Dimension por defecto protegida: `EMBEDDING_EXPECTED_DIMENSION=384`
- Modelo de embeddings cloud por defecto: `@cf/baai/bge-small-en-v1.5`

## 10. Plan de pruebas

Ver `ai-runtime-provider-profiles-test-plan-v1.md`.

## 11. Plan de rollout

1. Verificar perfil `local`.
2. Configurar variables del perfil cloud deseado en Vercel.
3. Ejecutar smoke de `/api/chat`.
4. Si el proveedor cloud responde y retrieval mantiene dimension compatible, promover a `GO`.
