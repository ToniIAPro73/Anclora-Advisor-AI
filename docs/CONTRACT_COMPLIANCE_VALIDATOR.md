# Contract Compliance Validator

## Proposito

El validador revisa contratos inmobiliarios para detectar riesgos legales, carencias documentales y condiciones que deban bloquear la firma hasta revision cualificada.

No rehace el contrato ni emite asesoramiento legal definitivo. Devuelve una respuesta JSON estable para que otros sistemas puedan decidir si continuar, pedir documentos o bloquear una firma.

## Rol en el ecosistema Anclora

- Nexus conserva documentos, permisos, expedientes, estados de firma y trazabilidad operativa.
- Advisor AI valida cumplimiento, riesgos, completitud documental y contexto normativo recuperado por RAG.
- Nexus puede llamar a Advisor AI antes de habilitar una firma o al recibir una nueva version contractual.

## Endpoint

- Ruta: `/api/validate-contract`
- Metodo: `POST`
- Dominio RAG: `inmobiliario`
- Alias externo: `legal -> inmobiliario` esta resuelto en `src/lib/rag/retrieval.ts`.
- Runtime LLM: `src/lib/ai/runtime.ts`. Por defecto `AI_RUNTIME_PROFILE=local` usa Ollama en `OLLAMA_BASE_URL`.

## Request

```json
{
  "contractText": "Texto completo del contrato...",
  "contractType": "arras",
  "operationType": "compraventa",
  "jurisdiction": "ES",
  "language": "es",
  "metadata": {
    "expedienteId": "exp-123"
  }
}
```

Tambien acepta nombres legacy:

```json
{
  "contract_id": "contract-123",
  "contract_text": "Texto completo del contrato...",
  "operation_type": "alquiler_temporada",
  "org_id": "org-123"
}
```

## Response

```json
{
  "status": "review_required",
  "block_signing": true,
  "confidence": 0.72,
  "summary": "La validacion requiere revision antes de continuar con la firma.",
  "findings": [
    {
      "severity": "critical",
      "category": "documentacion",
      "title": "Falta nota simple",
      "description": "No consta verificacion registral suficiente.",
      "recommendation": "Aportar nota simple actualizada antes de firmar.",
      "block_signing": true,
      "evidence": "..."
    }
  ],
  "required_actions": ["Aportar nota simple actualizada antes de firmar."],
  "missing_documents": [],
  "legal_disclaimer": "Este sistema ayuda a identificar riesgos y carencias documentales, pero no sustituye la revision de un abogado, notario o asesor cualificado.",
  "sources": [
    {
      "title": "Checklist compraventa",
      "source": "https://example.test/compraventa",
      "excerpt": "..."
    }
  ]
}
```

El servicio conserva campos legacy opcionales (`contract_id`, `compliance_check_passed`, `verification_timestamp`, `rag_sources_used`, `warnings`) para facilitar transiciones.

## Errores

Devuelve `400` cuando:

- El body no es JSON valido.
- Falta texto contractual.
- El texto contractual esta vacio o es demasiado corto.

Devuelve `200` con fallback seguro cuando:

- El runtime local/open-source no responde.
- El modelo devuelve JSON no parseable.
- No hay contexto RAG suficiente.

## Ejemplo curl

```bash
curl -X POST http://localhost:3000/api/validate-contract \
  -H 'Content-Type: application/json' \
  -d '{
    "contractText": "Contrato de compraventa inmobiliaria con precio, arras, cargas y condiciones de firma...",
    "operationType": "compraventa",
    "jurisdiction": "ES",
    "language": "es"
  }'
```

## Limitaciones legales

- No sustituye a un abogado.
- No sustituye a una notaria.
- No convierte una firma electronica ordinaria en firma cualificada.
- No debe usarse como unica base para firmar contratos de alto riesgo.

## Reglas de bloqueo de firma

- Si cualquier finding tiene `block_signing: true`, la respuesta global devuelve `block_signing: true`.
- Si cualquier finding tiene `severity: "critical"`, se normaliza a `block_signing: true`.
- Si el modelo devuelve JSON no parseable, el servicio devuelve `status: "review_required"` y `block_signing: true`.
- Si falla el runtime LLM, el servicio devuelve `status: "review_required"` y `block_signing: true`.
- Si no hay contexto RAG, el servicio devuelve `status: "review_required"` con warning seguro, pero no bloquea por esa razon salvo que existan otros hallazgos bloqueantes.

## Integracion desde Nexus

1. Nexus envia el texto contractual y metadatos del expediente a `/api/validate-contract`.
2. Advisor AI recupera contexto RAG del dominio `inmobiliario`.
3. Advisor AI valida con el runtime configurado, preferentemente local/Ollama.
4. Nexus guarda la respuesta completa en el expediente.
5. Nexus bloquea la firma si `block_signing === true`.
6. Nexus muestra `required_actions`, `missing_documents`, `findings` y `sources` al equipo operativo.

## Variables de entorno

```env
AI_RUNTIME_PROFILE=local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_PRIMARY=qwen2.5:14b
ADVISOR_CONTRACT_VALIDATOR_MODEL=qwen2.5:14b
ADVISOR_CONTRACT_VALIDATOR_MAX_TOKENS=1500
ADVISOR_CONTRACT_VALIDATOR_TEMPERATURE=0
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

El validador no requiere `ANTHROPIC_API_KEY`. Si `AI_RUNTIME_PROFILE=local`, la generacion se realiza mediante Ollama (`POST /api/chat`) usando `src/lib/ai/runtime.ts`.

## Checklist QA

- Ejecutar `npm run test:contract-compliance`.
- Ejecutar `npm run type-check`.
- Confirmar que no hay llamadas externas reales en tests.
- Probar con JSON invalido y verificar `400`.
- Probar con modelo devolviendo texto no JSON y verificar fallback seguro.
- Probar RAG sin chunks y verificar `review_required`.
- Confirmar que `legal_disclaimer` aparece siempre en respuestas `200`.
