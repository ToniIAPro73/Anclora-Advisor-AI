<!-- markdownlint-disable MD001 MD013 MD033 MD041 MD060 -->

<div align="center">

<img src="./public/brand/anclora-advisor-ai.png" alt="Anclora Advisor AI" width="132" />

# Anclora Advisor AI

### Tax, labor, and market advice for freelancers

AI-powered platform providing contextual guidance on tax, labor, and market matters. Processes legal documents, evaluates contract compliance, and generates recommendations based on current regulations.

[Español](./README.md) · **English**

<br />

![Anclora](https://img.shields.io/badge/Anclora-ecosystem-111827)
![Category](https://img.shields.io/badge/category-Internal-1DAB89)
![Languages](https://img.shields.io/badge/languages-ES%20%7C%20EN-047857)

</div>

---

> [!IMPORTANT]
> Internal Anclora ecosystem repository. Do not publish operational details, credentials, real data, or sensitive logic outside authorized channels.

## What is this

Advisor AI is an internal tool combining natural language processing, legal document validation, and regulatory compliance evaluation. It delivers personalized guidance on tax, labor, and commercial matters for freelancers, integrating external regulatory sources (current legislation, case law, test scenarios).

## Ecosystem category

| Field | Value |
|---|---|
| Category | Internal |
| Brand accent | `#1DAB89` |
| Typography | Inter |
| Canonical repository | `anclora-advisor-ai` |

## Key features

- Legal document validation (contracts, invoices, records)
- Regulatory and contractual compliance evaluation
- Contextual tax, labor, and market guidance
- Document ingestion and processing (RAG + embeddings)
- Alert management and task tracking
- Risk mitigation workflows for labor and tax matters
- Change auditing and decision traceability

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 15 |
| Frontend | React 19, TypeScript |
| AI / LLM | Anthropic Claude, OpenAI, Transformers |
| Database | Supabase (PostgreSQL) |
| Utilities | pdf-lib, nodemailer, zod |
| Testing | TSX, Playwright |
| Linting | ESLint 9 |

## Local startup

```bash
npm install
npm run dev
```

Local server: `http://localhost:3000`

Required environment variables: `.env.local` with Anthropic, OpenAI, and Supabase credentials.

## Supported languages

- Spanish (default)
- English

## Documentation and governance

- Brand contracts and governance: [`docs/standards/`](./docs/standards/)
- Anclora Vault (source of truth): `contracts/` and `docs/governance/`

---

<div align="center">

### Anclora Advisor AI

Internal use. AI-powered legal and tax advisory platform.

</div>
