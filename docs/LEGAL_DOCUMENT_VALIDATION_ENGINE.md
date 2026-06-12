# Legal Document Validation Engine

Validates legal documents against deterministic rules and LLM-based legal
analysis, with optional comparison against canonical templates.

---

## Endpoints

### `POST /api/legal-documents/validate`

Full validation: deterministic rules + RAG context retrieval + LLM analysis.

**Request**

```json
{
  "documentText": "...",
  "documentType": "compraventa",
  "jurisdiction": "España",
  "language": "es",
  "canonicalTemplate": "...",
  "documentId": "doc-abc123",
  "orgId": "org-xyz"
}
```

All fields accept camelCase or snake_case (`document_text`, `document_type`, etc.).

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
  "status": "ok | review_required | error",
  "block_signing": false,
  "risk_level": "low | medium | high | critical",
  "review_requirement": "none | recommended | required | urgent",
  "confidence": 0.85,
  "summary": "...",
  "findings": [],
  "differences": [],
  "required_actions": [],
  "missing_clauses": [],
  "legal_disclaimer": "...",
  "sources": [],
  "document_id": "doc-abc123",
  "validation_timestamp": "2026-01-15T10:00:00.000Z",
  "rag_sources_used": 3,
  "request_id": "..."
}
```

**Business rules**

- Any finding with `severity: "critical"` → `block_signing: true`.
- Any detected placeholder (`[...]`, `___`, `XXXX`, etc.) → `risk_level: critical`, `block_signing: true`.
- LLM failure or malformed response → `status: review_required`, `block_signing: true`.
- RAG failure → proceeds with empty context; may lower confidence.

---

### `POST /api/legal-documents/compare`

Deterministic-only comparison: no LLM call, no RAG. Fast and synchronous.

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
  ├─ buildLegalDocumentSystemPrompt()      — legal auditor persona
  ├─ buildLegalDocumentUserPrompt()        — doc text + diffs + RAG context
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

**Never logged**: raw contract text, names, DNI, addresses, banking data, or any personal information.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MODEL` | Falls back to `ADVISOR_CONTRACT_VALIDATOR_MODEL` | LLM model name |
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MAX_TOKENS` | `1500` | Max response tokens |
| `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_TEMPERATURE` | `0` | LLM temperature |

---

## Backward Compatibility

`POST /api/validate-contract` is unchanged. The new engine is purely additive.
