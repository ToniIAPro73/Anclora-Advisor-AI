# rag-ingestion-and-notebooklm-sync-spec-v1

Feature ID: `ANCLORA-RAG-INGEST-001`

## 1. Problema

El chat necesita grounding real desde conocimiento estructurado, pero no existe pipeline formal para ingestar cuadernos NotebookLM.

## 2. Objetivo

Definir e implementar (por Antigravity) una ingesta robusta de 3 cuadernos NotebookLM hacia el RAG del producto.

## 3. Alcance

- Acceso MCP a 3 cuadernos de NotebookLM.
- Extraccion y normalizacion de contenidos.
- Alta en `rag_documents` y `rag_chunks`.
- Generacion y validacion de embeddings de 384 dimensiones.
- Integracion con retrieval del chat y citas verificables.

## 4. No alcance

- Creacion de nuevos cuadernos NotebookLM.
- Entrenamiento de modelos propios.
- Rediseño completo del orquestador multi-agente.

## 5. Requisitos funcionales

- RF1: Ingerir 3 cuadernos identificados por:
  - `NOTEBOOK_1_ID` -> `fiscal` (Asesoría fiscal y tributaria).
  - `NOTEBOOK_2_ID` -> `laboral` (Normativa laboral y Seguridad Social).
  - `NOTEBOOK_3_ID` -> `mercado` (Inmobiliaria y mercado de alquileres).
- RF2: Mapear cada cuaderno a categoría `fiscal|laboral|mercado`.
- RF3: Crear/actualizar `rag_documents` con trazabilidad de fuente.
- RF4: Crear `rag_chunks` con `embedding vector(384)`.
- RF5: Respuestas del chat deben poder citar evidencia recuperada.

## 6. Estrategia de Chunking y Procesamiento

- **Tamaño máximo (max_chars)**: 1200 caracteres.
- **Solapamiento (overlap_chars)**: 200 caracteres para mantener contexto entre fragmentos.
- **Limpieza**:
  - Normalización UTF-8.
  - Eliminación de saltos de línea excesivos (máximo 2 seguidos).
  - Stripping de espacios en blanco en los extremos.
- **Deduplicación**: Hash SHA-256 del contenido del chunk para evitar duplicados en re-ingestas.

## 7. Contrato de Metadatos (Metadata Contract)

Cada fragmento (`rag_chunks`) debe estar vinculado a un `document_id` con los siguientes campos mínimos en base de datos:

- **rag_documents**:
  - `id`: UUID (Primary Key).
  - `title`: Título original del cuaderno o documento en NotebookLM.
  - `category`: `fiscal | laboral | mercado`.
  - `source_url`: URL pública o referencia interna del cuaderno.
  - `ingested_at`: Timestamp de la última sincronización.

- **rag_chunks**:
  - `id`: UUID (Primary Key).
  - `document_id`: Referencia a `rag_documents.id`.
  - `content`: Texto plano del fragmento.
  - `embedding`: Vector de 384 dimensiones.
  - `token_count`: Estimación de tokens para control de contexto.

## 8. Requisitos no funcionales

- RNF1: Seguridad de secretos y credenciales MCP.
- RNF2: Determinismo basico de chunking para reingestas.
- RNF3: Trazabilidad completa de ingesta (timestamps, source refs).

## 9. Riesgos

- Bloqueo de acceso MCP a uno o mas cuadernos.
- Incompatibilidad de embeddings con dimension requerida.
- Citas de chat sin evidencia real por problemas de retrieval.

## 10. Criterios de aceptacion

- CA1: 3 cuadernos ingeridos sin errores bloqueantes.
- CA2: `rag_documents` y `rag_chunks` consistentes y consultables.
- CA3: Consultas de prueba devuelven respuestas con citas validas.
- CA4: QA y Gate final en GO tras ejecucion real.

## 11. Plan de pruebas

Ver `rag-ingestion-and-notebooklm-sync-test-plan-v1.md`.

## 12. Plan de rollout

1. Ejecutar ingesta en entorno controlado.
2. Validar retrieval por dominio.
3. Activar en entorno principal con monitoreo.

