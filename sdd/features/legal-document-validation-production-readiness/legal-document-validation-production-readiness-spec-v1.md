# Spec v1 — Legal Document Validation Production Readiness

## Goal

Make Advisor AI a reliable legal document prevalidation engine for Anclora Nexus.

## In Scope

- Stable Nexus request/response contract.
- Internal API key authentication for legal document endpoints.
- Legal source quality checks with status, jurisdiction, authority, and confidence.
- Real-estate deterministic rules for sale, arras, rentals, KYC, mandate, reservation, inventory, and key handover.
- Safe fallback, timeout, retry, circuit breaker, and idempotency.
- Privacy-safe audit payloads without raw document text or sensitive PII.
- Integration tests with mocked LLM/RAG.
- Evaluation dataset and local evaluation script.

## Out of Scope

- Document repository, case management, or full file storage.
- Real external LLM/RAG calls in tests.
- Replacing `/api/validate-contract`.

## Acceptance Criteria

- `/api/legal-documents/validate` accepts the Nexus canonical contract.
- `/api/legal-documents/compare` and `/api/legal-documents/validate` reject unauthenticated internal calls.
- Critical risk always blocks signing.
- Invalid LLM JSON, timeout, or missing source quality never approves signing.
- `/api/validate-contract` remains backward compatible.
- `npm run lint`, `npm run type-check`, and `npm test` are the final gates.
