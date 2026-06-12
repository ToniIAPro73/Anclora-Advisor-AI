# QA — Legal Document Validation Engine

## Test Suites

| File | Cases | Coverage |
|------|-------|----------|
| `tests/unit/test-legal-document-rules.ts` | 13 | Deterministic rules — placeholder, clause, date, amount, risk escalation |
| `tests/unit/test-legal-document-diff.ts` | 14 | Document diff — normalization, identical docs, placeholder, missing sections, deduplication |
| `tests/unit/test-legal-document-validator.ts` | 23 | Validator DI — normalization, happy path, LLM failure, malformed JSON, placeholder risk, audit privacy |

**Total: 50 assertions — all DI-mocked, no real LLM/RAG/Supabase calls.**

Run all:

```bash
npx tsx tests/unit/test-legal-document-rules.ts
npx tsx tests/unit/test-legal-document-diff.ts
npx tsx tests/unit/test-legal-document-validator.ts
```

---

## Manual Smoke Tests

### Happy path — validate

```bash
curl -X POST http://localhost:3000/api/legal-documents/validate \
  -H "Content-Type: application/json" \
  -d '{
    "documentText": "Contrato de arrendamiento de temporada. Renta: 1.200 EUR. Duración: 2 meses. Fianza: 2.400 EUR. Inventario adjunto. Suministros incluidos. Rescisión según LAU.",
    "documentType": "alquiler_temporada",
    "jurisdiction": "España",
    "language": "es"
  }'
```

Expected: `status: "ok"`, `block_signing: false`, `risk_level: "low"`.

### Placeholder detection

```bash
curl -X POST http://localhost:3000/api/legal-documents/validate \
  -H "Content-Type: application/json" \
  -d '{
    "documentText": "Contrato. Arrendatario: [NOMBRE COMPLETO]. Precio: _____ EUR.",
    "documentType": "alquiler_temporada"
  }'
```

Expected: `block_signing: true`, `risk_level: "critical"`.

### Compare endpoint

```bash
curl -X POST http://localhost:3000/api/legal-documents/compare \
  -H "Content-Type: application/json" \
  -d '{
    "submittedText": "Contrato básico sin cláusulas.",
    "canonicalText": "Renta: 1.200 EUR. Duración: 2 meses. Fianza incluida. Inventario adjunto.",
    "documentType": "alquiler_temporada"
  }'
```

Expected: `differences` array non-empty, `block_signing` reflects risk level.

---

## Regression Checklist

- [ ] `POST /api/validate-contract` still works (backward compat)
- [ ] Validate returns `block_signing: true` for any `critical` finding
- [ ] Validate returns `block_signing: true` for any placeholder
- [ ] Validate returns `status: review_required` + `block_signing: true` on LLM failure
- [ ] Validate returns `status: review_required` + `block_signing: true` on malformed JSON
- [ ] Compare returns `differences: []` for identical documents
- [ ] Audit payload does not contain raw document text
- [ ] Typecheck passes: `npx tsc --noEmit`
