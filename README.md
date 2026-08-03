<!-- markdownlint-disable MD001 MD013 MD033 MD041 MD060 -->

<div align="center">

<img src="./public/brand/anclora-advisor-ai.png" alt="Anclora Advisor AI" width="132" />

# Anclora Advisor AI

### Asesoría fiscal, laboral y mercado para autónomos

Plataforma de inteligencia artificial que proporciona asesoramiento contextualizado en temas fiscales, laborales y de mercado. Procesa documentos legales, evalúa cumplimiento contractual y genera recomendaciones basadas en normativa vigente.

**Español** · [English](./README.en.md)

<br />

![Anclora](https://img.shields.io/badge/Anclora-ecosystem-111827)
![Categoría](https://img.shields.io/badge/categor%C3%ADa-Interna-1DAB89)
![Idiomas](https://img.shields.io/badge/idiomas-ES%20%7C%20EN-047857)

</div>

---

> [!IMPORTANT]
> Repositorio interno del ecosistema Anclora. No publicar detalles operativos, credenciales, datos reales ni lógica sensible fuera de canales autorizados.

## Qué es

Advisor AI es una herramienta interna que combina procesamiento de lenguaje natural, validación de documentos legales y evaluación de cumplimiento normativo. Proporciona asesoramiento personalizado en materias fiscales, laborales y comerciales para autónomos, integrando fuentes externas de información normativa (legislación vigente, jurisprudencia, casos de prueba).

## Categoría en el ecosistema

| Campo | Valor |
|---|---|
| Categoría | Interna |
| Acento de marca | `#1DAB89` |
| Tipografía | Inter |
| Repositorio canónico | `anclora-advisor-ai` |

## Funcionalidades principales

- Validación de documentos legales (contratos, facturas, registros)
- Evaluación de cumplimiento normativo y contractual
- Asesoramiento contextualizado fiscal, laboral y mercado
- Ingesta y procesamiento de documentación (RAG + embeddings)
- Gestión de alertas y seguimiento de tareas operativas
- Flujos de mitigación de riesgos para materias laborales e impositivas
- Auditoría de cambios y trazabilidad de decisiones

## Stack tecnológico

| Área | Tecnología |
|---|---|
| Framework | Next.js 15 |
| Frontend | React 19, TypeScript |
| IA / LLM | Anthropic Claude, OpenAI, Transformers |
| Base de datos | Supabase (PostgreSQL) |
| Utilidades | pdf-lib, nodemailer, zod |
| Testing | TSX, Playwright |
| Linting | ESLint 9 |

## Arranque local

```bash
npm install
npm run dev
```

Servidor local: `http://localhost:3000`

Variables de entorno requeridas: `.env.local` con credenciales de Anthropic, OpenAI y Supabase.

## Idiomas soportados

- Español (predeterminado)
- English

## Documentación y gobernanza

- Contratos de marca y gobernanza: [`docs/standards/`](./docs/standards/)
- Bóveda Anclora (fuente de verdad): `contracts/` y `docs/governance/`

---

<div align="center">

### Anclora Advisor AI

Uso interno. Plataforma de asesoramiento legal y fiscal impulsada por IA.

</div>
