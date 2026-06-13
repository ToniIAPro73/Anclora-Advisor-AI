# Legal Validation Production Readiness Audit

## Scope

This audit covers the Advisor AI legal document validation engine used by Anclora Nexus for document prevalidation. Advisor AI remains an analysis engine only: it does not store full legal files, manage case folders, or replace the Nexus document repository.

## Current State

- Runtime endpoints exist for `POST /api/legal-documents/compare`, `POST /api/legal-documents/validate`, and legacy `POST /api/validate-contract`.
- Validation already combines deterministic rules, canonical-template comparison, RAG retrieval, LLM output normalization, fallback handling, and privacy-safe audit hashes.
- Unit tests cover deterministic rules, validator fallback, malformed LLM JSON, audit privacy, and legacy contract route compatibility.
- Documentation exists in `docs/LEGAL_DOCUMENT_VALIDATION_ENGINE.md` and QA notes in `docs/QA_LEGAL_DOCUMENT_VALIDATION_ENGINE.md`.

## Production Risks

- The Nexus contract is not fully pinned to the canonical request/response shape used by the document-template library.
- Internal endpoints are not consistently protected by a dedicated Advisor API key.
- Source quality metadata is not enforced strongly enough for jurisdiction, status, validity dates, or authority.
- No approval should be returned when RAG sources are missing, expired, superseded, or jurisdictionally incompatible.
- Idempotency and retry behavior need explicit guarantees so Nexus can safely repeat requests.
- Real-estate document coverage should include arras, sale, seasonal rental, tourist rental, KYC, mandate, reservation, inventory, and key handover.
- Audit logs must continue to avoid raw document text, complete national IDs, full addresses, signatures, bank data, and excessive PII.

## Dependencies

- Next.js API routes under `src/app/api`.
- Local AI runtime abstraction in `src/lib/ai/runtime.ts`.
- RAG retrieval abstraction in `src/lib/rag/retrieval.ts`.
- Legal validation types in `src/types/legal-document-validation.ts`.
- Existing deterministic rules in `src/lib/legal-documents/deterministic-rules.ts`.

## Nexus Compatibility

- The legacy `/api/validate-contract` route must remain stable.
- Nexus should call `/api/legal-documents/validate` with a dedicated internal key header once configured.
- Responses must always include request id, engine version, prompt version, legal disclaimer, findings, differences, sources, required actions, and signing-block status.
- Technical failures, invalid JSON, missing sources, or insufficient source quality must degrade to human review and must not approve signing.

## Required Actions

- Stabilize the Nexus request/response contract and extend tests.
- Add internal API key auth, safe compare, rate limit, and access logs.
- Enforce legal source quality and validity.
- Add real-estate validation rules and integration scenarios.
- Add idempotency, timeout, retry, fallback, and a simple circuit breaker.
- Harden audit payload privacy and traceability.
- Add synthetic evaluation data and a deterministic evaluation script.
- Update deployment, integration, QA, and rollback documentation.
