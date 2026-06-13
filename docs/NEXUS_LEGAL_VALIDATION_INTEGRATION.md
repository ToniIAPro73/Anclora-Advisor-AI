# Nexus Legal Validation Integration

## Endpoint

Nexus should call:

```http
POST /api/legal-documents/validate
x-advisor-internal-api-key: <ADVISOR_INTERNAL_API_KEY>
x-advisor-caller: nexus
x-request-id: <trace-id>
```

## Request Contract

```json
{
  "documentId": "doc_123",
  "templateId": "tpl_arras",
  "templateVersionId": "tpl_arras_v3",
  "documentType": "arras",
  "operationType": "reservation",
  "jurisdiction": "España",
  "language": "es",
  "canonicalText": "canonical template text",
  "currentText": "generated document text",
  "variableSnapshot": { "price": "250.000 EUR", "jurisdiction": "España" },
  "metadata": { "caseId": "case_123" },
  "sourceHints": ["LAU", "Código Civil"],
  "requestId": "nexus-idempotent-request-id"
}
```

## Response Contract

Nexus must treat `block_signing: true` as a hard stop for signature.

Statuses:

- `approved`: no blocking issue detected and sources are sufficient.
- `approved_with_warnings`: non-blocking findings exist.
- `review_required`: human review is required; do not sign automatically.
- `rejected`: reserved for explicit rejection flows.

Review levels:

- `none`
- `internal_review`
- `legal_review`
- `notarial_review`

## Auth And Errors

- `401`: missing internal API key.
- `403`: invalid internal API key.
- `429`: caller rate limit exceeded.
- `503`: Advisor key is not configured.
- `400`: invalid JSON or missing document text.

## Source Quality

Advisor validates each RAG source for jurisdiction, status, authority, review date,
identifier/URL/type, and confidence. Missing, uncertain, expired, superseded, or
jurisdiction-mismatched sources cannot produce silent approval.

## Idempotency

Use a stable `requestId` per Nexus validation request. Repeated requests with the
same request id and payload return the cached result during the idempotency TTL.

## Privacy

Do not send unnecessary PII. Advisor stores audit hashes and metadata only. It does
not log raw document text, complete DNI/NIE values, full addresses, signatures, or
bank data.

## Rollback

If the new endpoint must be disabled, Nexus can temporarily route to the previous
manual review workflow. Do not bypass `block_signing`; technical failures should
remain review-required.
