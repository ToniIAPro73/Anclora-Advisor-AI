# Anclora Advisor AI

Aplicación de asesoría fiscal, laboral y mercado inmobiliario para autónomos pluriactividad.

## Stack

- Next.js 15 + React 19
- TypeScript
- Supabase PostgreSQL + pgvector
- Anthropic Claude + Ollama Mistral

## Branding canónico

- Familia visual: `Internal` · baseline de referencia interna del ecosistema Anclora
- Tipografía display: `Cormorant Garamond`
- Tipografía body: `Source Sans 3`
- Accent placeholder: `#1dab89` mint · base placeholder: `#162944` navy
- Prefijo de componentes: `advisor-` · prefijo de assets: `advisor_`
- Assets finales (icono + paleta): pendientes — se sustituirán cuando el usuario los entregue
- Módulo de branding: `src/lib/advisor-brand.ts`

Lectura mínima antes de tocar interfaz:

1. `docs/standards/ANCLORA_INTERNAL_APP_CONTRACT.md`
2. `docs/standards/UI_MOTION_CONTRACT.md`
3. `docs/standards/MODAL_CONTRACT.md`
4. `docs/standards/LOCALIZATION_CONTRACT.md`

## Quick Start

```bash
npm install
npm run dev
```

Accede a: http://localhost:3000

## Próximos pasos

1. Editar .env.local con credenciales Supabase
2. npm install
3. npm run dev
