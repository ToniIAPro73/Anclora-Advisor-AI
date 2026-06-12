# Legal Document Validation Engine — Audit Report

## 1. Scope

Audit performed prior to implementing the Legal Document Validation Engine
(`feat/advisor-legal-document-validation-engine`). Covers reusable pieces,
gaps, risks, and adaptation decisions.

---

## 2. Architecture Found

### 2.1 Existing Contract Compliance Validator

**Path**: `src/lib/contracts/contract-compliance-validator.ts`

Full DI-based validator already in production:

- `ContractValidatorDependencies`: `{ retrieve, generate, now }` — enables unit
  testing without real RAG or LLM calls.
- `validateContractCompliance(rawBody, requestId, deps)`: 10-step flow —
  normalize → retrieve RAG context → build prompts → call LLM → parse findings
  → finalize → audit log.
- `normalizeContractRequest(raw)`: accepts both camelCase and snake_case inputs.
- `buildFallbackResponse(...)`: returns `review_required` + `block_signing: true`
  on any LLM/RAG failure (fail-safe degradation).
- `finalizeResponse(...)`: applies business rule — any critical finding forces
  `block_signing: true`.
- `LEGAL_DISCLAIMER` constant injected into every response.

**Reuse decision**: The new engine mirrors this pattern exactly. Same DI
interface, same fallback logic, same finalization rules.

### 2.2 RAG Retrieval

**Path**: `src/lib/rag/retrieval.ts`

- `retrieveContext(query, { category, limit, threshold })`: Supabase vector
  search returning ranked chunks.
- Domain alias map: `legal → inmobiliario`. The new engine uses `category:
  "legal"` which resolves to the same embedding space.
- Configurable `threshold` (default 0.7) and `limit` (default 5).

**Reuse decision**: Call `retrieveContext` directly with `category: "legal"`.
No changes needed to retrieval layer.

### 2.3 Audit Logging

**Path**: `src/lib/audit/logs.ts`

- `createAuditLog(supabase, input)` accepts `AuditDomain`.
- Current `AuditDomain` values: `"fiscal" | "labor" | "invoices" | "admin_rag"`.
- **Gap**: `"contracts"` is NOT included. Must be added.

**Adaptation**: Extend `AuditDomain` union to include `"contracts"`.

### 2.4 AI Runtime

**Path**: `src/lib/ai/runtime.ts`

- `generateChatText(messages, profile)`: multi-provider support (ollama,
  cloudflare, groq).
- `AIRuntimeProfile`: model, maxTokens, temperature — driven by env vars.
- New engine uses same runtime. New env vars follow the pattern
  `ADVISOR_LEGAL_DOCUMENT_VALIDATOR_*`.

### 2.5 RAG Prompt Layer

**Path**: `src/lib/rag/contract-compliance-prompt.ts`

- `buildComplianceSystemPrompt()`: legal auditor persona with strict
  source-citation requirements.
- `buildComplianceUserPrompt(req, ragContext)`: assembles the user turn.

**Gap**: These prompts are optimized for single-contract compliance review, not
for two-document comparison (submitted vs. canonical template). A new prompt
module is required.

### 2.6 API Surface

**Path**: `src/app/api/validate-contract/route.ts`

- DI-based `POST` handler wrapping `validateContractCompliance`.
- Must remain untouched (backward compatibility constraint).

**New endpoints required**:
- `POST /api/legal-documents/compare`
- `POST /api/legal-documents/validate`

### 2.7 Type System

**Path**: `src/types/contract-compliance.ts`

Existing types: `ContractFinding`, `ContractComplianceResponse`,
`ValidateContractRequest`, `NormalizedValidateContractRequest`.

**Gap**: No types for legal document diff, template comparison, or the new
validation request/response shapes. A new type file is required.

### 2.8 Tests

**Path**: `tests/unit/`

Existing: `test-contract-compliance.ts`, `test-validate-contract-route.ts`.
Pattern: pure unit tests with DI mocks for `retrieve` and `generate`.

**Reuse decision**: New tests follow the same DI mock pattern in
`tests/unit/test-legal-document-*.ts`.

---

## 3. Gaps Identified

| Gap | Severity | Resolution |
|-----|----------|------------|
| `AuditDomain` missing `"contracts"` | High | Extend union in `logs.ts` |
| No deterministic document diff | High | Create `document-diff.ts` |
| No placeholder/field detection rules | High | Create `deterministic-rules.ts` |
| No template comparison prompt | High | Create `legal-document-validation-prompt.ts` |
| No `LegalDocumentValidationRequest` types | High | Create `legal-document-validation.ts` |
| No `/api/legal-documents/*` endpoints | High | Create `compare` and `validate` routes |
| No `src/lib/legal-documents/` directory | Medium | Create on Phase 2 |
| `.env.example` missing new model vars | Low | Update on Phase 8 |

---

## 4. Risks

| Risk | Mitigation |
|------|------------|
| LLM returns malformed JSON | `buildFallbackResponse` always applied on parse error |
| RAG returns no chunks | Validator degrades gracefully; `review_required` returned |
| Full contract text sent to LLM | Only extracted fields + RAG context sent; raw text excluded from audit logs |
| DNI / addresses in logs | Audit trail logs request id, model, hashes, risk level — NOT personal data |
| Backward compat break on `/api/validate-contract` | Route untouched; new engine is additive |

---

## 5. Adaptation Decisions

1. **Reuse DI pattern** from `contract-compliance-validator.ts` verbatim.
2. **Extend `AuditDomain`** rather than creating a parallel audit system.
3. **New type file** `src/types/legal-document-validation.ts` — does not modify
   existing `contract-compliance.ts`.
4. **New lib directory** `src/lib/legal-documents/` for deterministic rules and
   diff logic (no LLM dependency in that layer).
5. **New prompt module** `src/lib/rag/legal-document-validation-prompt.ts` —
   specialized for two-document comparison with mandatory source citation.
6. **Maintain `/api/validate-contract`** as a thin wrapper; do not refactor it.
7. **Privacy boundary**: audit logs store `sha256(contractText)` as reference,
   never the raw text, DNI, addresses, or banking data.
