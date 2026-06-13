# Legal Document Validation Engine

Validates legal documents against deterministic rules, source quality controls,
canonical-template comparison, and LLM-based legal analysis.

---

## Endpoints

### `POST /api/legal-documents/validate`

Full validation: deterministic rules + RAG context retrieval + LLM analysis.

Requires internal authentication:

- Header: `x-advisor-internal-api-key: <ADVISOR_INTERNAL_API_KEY>`
- Optional caller trace: `x-advisor-caller: nexus`

**Canonical Nexus request**

```json
{
  "documentId": "doc-abc123",
  "templateId": "tpl-compraventa",
  "templateVersionId": "tpl-compraventa-v1",
  "documentType": "compraventa",
  "operationType": "sale",
  "jurisdiction": "España",
  "language": "es",
  "canonicalText": "...",
  "currentText": "...",
  "variableSnapshot": {},
  "metadata": {},
  "sourceHints": [],
  "requestId": "nexus-request-id"
}
```

Legacy aliases remain accepted (`documentText`, `canonicalTemplate`,
`document_text`, `canonical_template`, etc.).

| Field | Required | Description |
|-------|----------|-------------|
| `documentText` | Yes | Full text of the document to validate |
| `documentType` | No | `compraventa`, `alquiler_temporada`, `alquiler_turistico`, `arras`, etc. |
| `jurisdiction` | No | Defaults to `España` |
| `language` | No | Defaults to `es` |
| `canonicalTemplate` | No | Reference template for diff comparison |
| `documentId` | No | Caller-provided document identifier |
| `orgId` | No | Organisation identifier for audit |

**Response**

```json
{
  "status": "approved | approved_with_warnings | review_required | rejected",
  "block_signing": false,
  "risk_level": "low | medium | high | critical",
  "review_requirement": "none | internal_review | legal_review | notarial_review",
  "confidence": 0.85,
  "summary": "...",
  "findings": [],
  "differences": [],
  "required_actions": [],
  "unresolved_placeholders": [],
  "missing_clauses": [],
  "missing_documents": [],
  "legal_disclaimer": "...",
  "sources": [],
  "document_id": "doc-abc123",
  "validation_timestamp": "2026-01-15T10:00:00.000Z",
  "rag_sources_used": 3,
  "request_id": "..."
  "engine_version": "legal-validation-v1",
  "prompt_version": "legal-document-validation-prompt-v1"
}
```

**Business rules**

- Any finding with `severity: "critical"` → `block_signing: true`.
- Any detected placeholder (`[...]`, `___`, `XXXX`, etc.) → `risk_level: critical`, `block_signing: true`.
- LLM failure, malformed response, timeout, or circuit breaker → `status: review_required`, `block_signing: true`.
- No usable legal source → `status: review_required`, `block_signing: true`.
- Superseded, uncertain, expired, low-confidence, or jurisdiction-mismatched sources reduce confidence and force review or block depending on severity.
- Critical deterministic risk always blocks signing.

---

### `POST /api/legal-documents/compare`

Deterministic-only comparison: no LLM call, no RAG. Fast and synchronous.
Requires the same internal auth header as validation.

**Request**

```json
{
  "submittedText": "...",
  "canonicalText": "...",
  "documentType": "compraventa",
  "language": "es"
}
```

`submittedText` and `canonicalText` are required.

**Response**

```json
{
  "differences": [],
  "risk_level": "low",
  "review_requirement": "none",
  "summary": "...",
  "block_signing": false,
  "legal_disclaimer": "...",
  "request_id": "..."
}
```

---

## Architecture

```
POST /api/legal-documents/validate
  │
  ├─ normalizeLegalDocumentRequest()       — input sanitization, camel/snake
  ├─ runDeterministicRules()               — placeholder, clause, date, amount
  ├─ retrieveContext(category: "legal")    — RAG vector search
  ├─ evaluateLegalSources()                — authority, jurisdiction, status, validity
  ├─ buildLegalDocumentSystemPrompt()      — legal auditor persona
  ├─ buildLegalDocumentUserPrompt()        — doc text + diffs + RAG context
  ├─ runWithLegalValidationResilience()    — timeout, retry, circuit breaker
  ├─ deps.generate()                       — LLM call (DI-injectable)
  ├─ parseAndMergeFindings()               — normalize + merge deterministic + LLM
  ├─ finalizeRiskAndBlockSigning()         — business rules
  └─ buildAuditPayload()                   — privacy-safe audit (hashes only)

POST /api/legal-documents/compare
  │
  ├─ normalizeLegalCompareRequest()
  ├─ runDeterministicRules()
  ├─ compareDocuments()                    — diff + risk + review_requirement
  └─ LegalDocumentCompareResponse
```

---

## Dependency Injection

Both the validator and the compare engine accept a `deps` object for testing:

```typescript
import { validateLegalDocument } from "@/lib/legal-documents/legal-document-validator";
import type { LegalDocumentValidatorDependencies } from "@/lib/legal-documents/legal-document-validator";

const testDeps: LegalDocumentValidatorDependencies = {
  retrieve: async () => ({ chunks: [], query: "", cached: false }),
  generate: async () => JSON.stringify({ status: "ok", findings: [] }),
  now: () => new Date("2026-01-15T10:00:00Z"),
};

const result = await validateLegalDocument(body, "req-id", testDeps);
```

---

## Privacy

The audit trail (`LegalDocumentAuditPayload`) stores:

- `sha256(documentText)` — hash, not raw text
- `sha256(canonicalTemplate)` — hash if provided
- `risk_level`, `block_signing`, `status`, `findings_count`, `differences_count`
- `model_used`, `rag_sources_used`, `request_id`, `document_id`, `org_id`
- `template_version_id`, `prompt_version`, `engine_version`, source statuses,
  duration, fallback flag, and hashes

**Never logged**: raw contract text, names, DNI, addresses, banking data, or any personal information.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADVISOR_INTERNAL_API_KEY` | none | Required key for internal legal validation endpoints |
| `ADVISOR_LEGAL_VALIDATION_MODEL` | fallback model | Canonical model override |
| `ADVISOR_LEGAL_VALIDATION_MAX_TOKENS` | legacy value / `1500` | Max LLM response tokens |
| `ADVISOR_LEGAL_VALIDATION_TEMPERATURE` | legacy value / `0` | LLM temperature |
| `ADVISOR_LEGAL_VALIDATION_TIMEOUT_MS` | `20000` | LLM timeout |
| `ADVISOR_LEGAL_VALIDATION_PROMPT_VERSION` | `legal-document-validation-prompt-v1` | Prompt version returned to Nexus |
| `ADVISOR_LEGAL_VALIDATION_ENGINE_VERSION` | `legal-validation-v1` | Engine version returned to Nexus |
| `ADVISOR_LEGAL_VALIDATION_RATE_LIMIT` | `120` | Requests per caller per minute |
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MODEL` | Falls back to `ADVISOR_CONTRACT_VALIDATOR_MODEL` | LLM model name |
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MAX_TOKENS` | `1500` | Max response tokens |
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_TEMPERATURE` | `0` | LLM temperature |

---

## Backward Compatibility

`POST /api/validate-contract` is unchanged. The new engine is purely additive.
