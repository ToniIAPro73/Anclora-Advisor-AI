# Shared Context - rag-ingestion-and-notebooklm-sync

## Referencias

- Baseline delivery: `.antigravity/prompts/features/_feature-delivery-baseline.md`
- Baseline QA/Gate: `.antigravity/prompts/features/_qa-gate-baseline.md`
- DB schema: `supabase/migrations/20260225235038_initial_schema.sql`
- Skill base RAG: `.agent/skills/features/rag-grounding-and-citations/SKILL.md`

## Variables obligatorias para ejecucion

- `NOTEBOOK_1_ID`
- `NOTEBOOK_2_ID`
- `NOTEBOOK_3_ID`
- `NOTEBOOK_1_DOMAIN` (`fiscal|laboral|mercado`)
- `NOTEBOOK_2_DOMAIN` (`fiscal|laboral|mercado`)
- `NOTEBOOK_3_DOMAIN` (`fiscal|laboral|mercado`)
- `MCP_NOTEBOOKLM_PROVIDER`
- `EMBEDDING_MODEL_NAME`
- `EMBEDDING_DIM=384`

## Valores definidos para esta ejecucion

- `NOTEBOOK_1_ID=ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- `NOTEBOOK_2_ID=ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- `NOTEBOOK_3_ID=ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`
- `NOTEBOOK_1_DOMAIN=fiscal`
- `NOTEBOOK_2_DOMAIN=laboral`
- `NOTEBOOK_3_DOMAIN=mercado`

## Contratos

- `rag_documents`: alta por cuaderno/fuente.
- `rag_chunks`: chunks normalizados con `embedding vector(384)`.
- Citas en chat deben referenciar fuentes de `rag_documents/rag_chunks`.

## Scope por cuaderno (obligatorio)

### `ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- Proposito: escudo juridico-financiero.
- Solo fuentes de fiscalidad autonomo Espana/Baleares (IAE, IVA, IRPF, RETA, deducciones, inspeccion, escenarios de facturacion).

### `ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- Proposito: airbag estrategico de transicion.
- Solo fuentes de pluriactividad, compatibilidades, riesgo contractual/laboral y mitigacion reputacional.

### `ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`
- Proposito: motor comercial (autoridad -> conversion).
- Solo fuentes de posicionamiento premium inmobiliario, diferenciacion, narrativa estrategica y conversion comercial.

Regla transversal:
- Toda fuente debe incluir `reason_for_fit`.
- Si no encaja en su cuaderno: `SOURCE_SCOPE_MISMATCH` y `NO-GO`.
