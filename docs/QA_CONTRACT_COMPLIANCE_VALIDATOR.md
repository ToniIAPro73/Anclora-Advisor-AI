# QA Contract Compliance Validator

Fecha: 2026-06-12

## Archivos modificados

- `.env.example`
- `package.json`
- `src/app/api/validate-contract/route.ts`
- `src/lib/ai/runtime.ts`
- `src/lib/contracts/contract-compliance-validator.ts`
- `src/lib/rag/contract-compliance-prompt.ts`
- `src/types/contract-compliance.ts`
- `tests/unit/test-contract-compliance.ts`
- `tests/unit/test-validate-contract-route.ts`
- `docs/CONTRACT_COMPLIANCE_VALIDATOR.md`
- `docs/QA_CONTRACT_COMPLIANCE_VALIDATOR.md`

## Tests anadidos

- `tests/unit/test-validate-contract-route.ts`
  - `POST` sin JSON valido devuelve `400`.
  - `POST` sin texto contractual devuelve `400`.
  - Body valido + JSON correcto del modelo devuelve `200`.
  - Finding con `block_signing: true` propaga bloqueo global.
  - Severity `critical` propaga bloqueo global aunque el modelo no marque `block_signing`.
  - JSON no parseable del modelo devuelve `200`, `review_required` y bloqueo.
  - RAG sin contexto suficiente devuelve `200` con warning seguro.
  - La respuesta incluye siempre `legal_disclaimer`.

- `tests/unit/test-contract-compliance.ts`
  - Normalizacion de request nuevo y legacy.
  - Rechazo de bodies invalidos.
  - Prompt con contrato normalizado y contexto RAG.
  - Reglas de bloqueo y fallback seguro en el servicio.

## Tests ejecutados

```bash
npm run test:contract-compliance
```

Resultado: OK. 44 assertions pasadas.

```bash
npm run type-check
```

Resultado: OK.

```bash
npm run lint
```

Resultado: OK.

## Decisiones tecnicas

- Se elimino Anthropic del endpoint `/api/validate-contract`.
- El validador usa `generateChatText` de `src/lib/ai/runtime.ts`.
- Con `AI_RUNTIME_PROFILE=local`, el runtime usa Ollama (`POST /api/chat`) y modelos open-source configurados por entorno.
- Se anadieron opciones opcionales a `generateChatText`:
  - `temperature`
  - `maxTokens`, traducido a `num_predict` en Ollama y `max_tokens` en proveedores OpenAI-compatible.
- La ruta Next queda como wrapper fino y la logica vive en `src/lib/contracts/contract-compliance-validator.ts` para testear sin servicios externos.
- Se mantiene compatibilidad de entrada con campos legacy (`contract_text`, `operation_type`, `contract_id`, `org_id`) y campos nuevos (`contractText`, `operationType`, `metadata`).
- Se conservan campos legacy opcionales de respuesta (`contract_id`, `compliance_check_passed`, `verification_timestamp`, `rag_sources_used`, `warnings`) para no romper consumidores existentes durante la transicion.

## Adaptaciones respecto al prompt original

- El repo usa `retrieveContext`, no `retrieveChunks`; se reutilizo `retrieveContext` con categoria `inmobiliario`.
- El alias `legal -> inmobiliario` ya existia en `src/lib/rag/retrieval.ts` y no se modifico.
- Por instruccion del usuario, no se uso Anthropic. La implementacion queda orientada a alternativas gratuitas/locales, especialmente Ollama.
- `.env.example` ya tenia `ANTHROPIC_API_KEY`, pero el validador no la requiere ni la documenta como necesaria.

## Riesgos pendientes

- La calidad juridica dependera del modelo local seleccionado y de la calidad del corpus RAG inmobiliario.
- `ADVISOR_CONTRACT_VALIDATOR_MAX_TOKENS` limita generacion, pero modelos locales pequenos pueden seguir devolviendo JSON imperfecto; el fallback seguro cubre ese caso.
- No se ejecuto una prueba manual contra un Ollama real en esta QA; los tests mockean el runtime para evitar llamadas externas.
- El repo aun conserva usos historicos de Anthropic en scripts y documentacion no relacionados con este endpoint.

## Checklist QA

- [x] Endpoint devuelve JSON estable.
- [x] Fallo de JSON del modelo degrada de forma segura.
- [x] Fallo del runtime degrada de forma segura.
- [x] RAG sin contexto no rompe el endpoint.
- [x] `critical` bloquea firma.
- [x] Finding con `block_signing: true` bloquea firma global.
- [x] Disclaimer legal presente.
- [x] Tests route-level con mocks.
- [x] Documentacion operativa creada.
