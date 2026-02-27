# Agent D (Retrieval + Chat) - rag-ingestion-and-notebooklm-sync

Objetivo: conectar retrieval real al flujo de chat con citas confiables.

Precondicion obligatoria (handoff de Agent C):

1. Agent C debe haber ejecutado preflight de entorno Supabase sin modificar `.env.local`.
2. Si Agent C reporta `ENV_MISMATCH=SUPABASE_PROJECT_REF_CONFLICT`, detener inmediatamente con `NO-GO`.
3. Agent C debe confirmar:
   - backfill aplicado solo a `rag_chunks` con `embedding IS NULL`
   - sin uso de OpenAI
   - embeddings locales `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
   - dimension obligatoria `384`
4. Evidencia minima requerida desde Agent C:
   - `pending_before`
   - `updated_count`
   - `pending_after` (esperado 0)
   - `bad_dim_count` (esperado 0)

Si falta cualquiera de esos puntos, detener y reportar bloqueo.

Tareas:

1. Ajustar capa de retrieval para consultar `rag_chunks` por similitud.
2. Priorizar dominio segun routing (`fiscal|laboral|mercado`).
3. Construir respuesta con citas derivadas de documentos recuperados.
4. Definir fallback cuando no hay evidencia suficiente:
   - responder incertidumbre
   - recomendar accion segura
   - no inventar fuente

Validaciones:

- Cada respuesta con grounding debe incluir al menos 1 cita valida.
- Sin resultados -> politica de no alucinacion aplicada.

Salida esperada:

- Chat con grounding verificable y trazabilidad de fuentes.
