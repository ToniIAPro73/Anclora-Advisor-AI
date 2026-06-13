# QA Legal Validation Production Readiness

## Automated Gates

```bash
npm run lint
npm run type-check
npm test
npm run legal:eval
```

## Covered Scenarios

- Template unchanged.
- Minor non-blocking warning.
- Critical price change.
- Placeholder.
- Missing legal source.
- Expired legal source.
- Invalid LLM JSON.
- Timeout fallback.
- Invalid auth.
- Repeated idempotent request.
- Legacy `/api/validate-contract` compatibility.
- Compare endpoint auth.

## Manual Production Checklist

- `ADVISOR_INTERNAL_API_KEY` configured only server-side.
- Nexus sends `x-advisor-internal-api-key` and stable `requestId`.
- RAG sources include status, jurisdiction, authority, URL/identifier, type, confidence, and review date.
- Audit review confirms no raw document text or sensitive PII is persisted.
- Rollback path routes documents to human legal review instead of auto-approval.
