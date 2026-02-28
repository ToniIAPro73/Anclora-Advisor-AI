# Roadmap de Features RAG - Anclora Advisor AI

Este roadmap consolida los planes de `Plan_de_Mejoras_RAG.md` y `plan_integral_mejoras_gemini_3_1_pro.md` en una secuencia ejecutable para el stack actual del repo (Next.js + TypeScript + Supabase + Ollama).

## Objetivo

Mejorar calidad, fiabilidad y gobernanza del asistente antes de optimizaciones de hardware avanzadas.

## KPIs globales

- `hit@5` por dominio (`fiscal`, `laboral`, `mercado`)
- `MRR@5` por dominio
- `% respuestas con citas`
- `% fallback sin evidencia`
- latencia p50/p95 en `/api/chat`
- `Decision=NO-GO` automático ante `ENV_MISMATCH` o `SOURCE_SCOPE_MISMATCH`

## Fase 0 - Fundación y métricas (P0)

### Features

1. `RAG-EVAL-001`: Dataset canónico de evaluación y runner local.
2. `RAG-METRICS-001`: Reporte automático de métricas base.
3. `RAG-GOV-001`: Validaciones de gobernanza de ingesta (project_ref y scope NotebookLM).

### Definition of Done

1. Existe dataset versionado en `docs/evals/`.
2. Existe comando ejecutable para evaluación (`npm run rag:eval`).
3. El reporte muestra métricas globales y por dominio.

## Fase 1 - Calidad de recuperación (P1)

### Features

1. `RAG-RETR-001`: Hybrid search (`pgvector` + FTS/BM25) con fusión RRF.
2. `RAG-RETR-002`: Metadata filtering (`domain`, `regimen`, `jurisdiction`, `effective_date`).
3. `RAG-RETR-003`: Chunking legal estructural + chunking semántico.
4. `RAG-RERANK-001`: Re-ranker local (top20 -> top5).

### Definition of Done

1. `hit@5` y `MRR` mejoran frente a Fase 0.
2. Baja `% fallback sin evidencia` en consultas in-domain.
3. No sube falso positivo en out-of-domain.

## Fase 2 - Fiabilidad de respuesta (P1)

### Features

1. `AGENT-GUARD-001`: Verificador de contradicciones respuesta-contexto.
2. `TOOLS-CALC-001`: Tool calling para cálculos fiscales/laborales.
3. `CHAT-CIT-001`: Citas inline obligatorias cuando hay evidencia.
4. `CHAT-FALLBACK-001`: Fallback estricto en out-of-domain.

### Definition of Done

1. Cero cálculos críticos hechos directamente por LLM.
2. `% respuestas con citas` sube sin degradar precisión.
3. Out-of-domain devuelve fallback sin citas.

## Fase 3 - Ingesta y seguridad (P2)

### Features

1. `ADMIN-RBAC-001`: Roles (`admin|partner|user`) y control de acceso.
2. `ADMIN-INGEST-001`: API de ingesta segura con validación de rol.
3. `ADMIN-KB-001`: UI para documentos indexados, metadatos y baja de chunks.
4. `ADMIN-JOBS-001`: Estado de jobs de ingesta/reingesta.

### Definition of Done

1. Rutas y API de admin bloqueadas para no-admin.
2. Tanda inválida de fuentes produce `SOURCE_SCOPE_MISMATCH`.
3. Se mantiene canonicidad `project_ref=lvpplnqbyvscpuljnzqf`.

## Fase 4 - Observabilidad y UX pro (P2)

### Features

1. `OBS-RAG-001`: Trazas de pipeline RAG y métricas de latencia.
2. `CHAT-STREAM-001`: Streaming SSE para respuestas de chat.
3. `UX-CIT-001`: Popover de evidencia en UI.
4. `ALERTS-PRO-001`: Alertas proactivas por fechas/obligaciones.

### Definition of Done

1. Dashboard interno con trazas y fallos por etapa.
2. Chat en streaming operativo en frontend.
3. Citas accionables visibles por usuario final.

## Fase 5 - Optimización hardware avanzada (P3)

### Features

1. `PERF-HW-001`: Benchmark comparativo real por perfiles/runtime (`perf:benchmark:hardware`).
2. `PERF-HW-002`: Política automática para mantener/cambiar runtime principal (`perf:benchmark:runtime-gate`).
3. `PERF-HW-003`: Validación de baseline de cuantización y modelos en Ollama (`perf:validate:baseline`).

### Definition of Done

1. Mejora de latencia p95 >= 20% sin bajar calidad RAG.
2. Métricas térmicas/estabilidad aceptables bajo carga.
3. Reversibilidad de configuración documentada.

## Orden recomendado de ejecución

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5

## Feature implementada en este ciclo

- `RAG-EVAL-001`: dataset + runner local de evaluación RAG.
- `RAG-METRICS-001`: reporte automático JSON + umbrales + decisión GO/NO-GO (`rag:eval:gate`).
- `PERF-HW-001`: benchmark hardware/runtime con reporte JSON (`perf:benchmark:hardware`).
- `PERF-HW-002`: gate automático para conservar Ollama como runtime principal salvo mejora demostrable.
- `PERF-HW-003`: validación automática del baseline de cuantización/modelos en Ollama.
