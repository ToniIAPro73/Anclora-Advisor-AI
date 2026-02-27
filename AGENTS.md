# AGENTS.md

## Objetivo del repositorio
Anclora Advisor AI es una aplicación web para consultas de asesoría fiscal, laboral y mercado inmobiliario con arquitectura Next.js + TypeScript + Supabase.

## Stack actual
- Next.js 15 + React 19
- TypeScript
- Supabase (`@supabase/supabase-js`)
- API route en `src/app/api/chat/route.ts`

## Estructura relevante
- `src/app/`: App Router y endpoints API.
- `src/components/features/`: UI de chat.
- `src/hooks/`: lógica cliente (`useChat`).
- `lib/agents/`: orquestador backend.
- `supabase/migrations/`: esquema SQL.
- `docs/`: arquitectura, análisis y planes.
- `scripts/`: artefactos de migración/prototipos (no fuente principal de runtime).

## Convenciones de trabajo
- Priorizar cambios en `src/`, `lib/` y `supabase/`.
- Mantener tipado estricto y evitar `any`.
- No exponer secretos en cliente; claves sensibles solo en servidor.
- Actualizar documentación en `docs/` cuando cambie arquitectura o flujo.

## Gobernanza de layout (obligatoria)
- En rutas `/dashboard/*` no se permite scroll vertical global del documento (`body/html`).
- El shell debe ajustarse a viewport (`h-screen`) y usar `overflow-hidden` a nivel de contenedor principal.
- Si una vista necesita desplazamiento, debe ser interno al panel/slot de contenido (ej. chat timeline, tablas).
- Cualquier cambio de UI que reintroduzca scroll vertical global en dashboard implica `Decision=NO-GO`.

## Supabase canónico por repo
- Este repo (Anclora Advisor AI) solo usa el `project_ref` `lvpplnqbyvscpuljnzqf`.
- `jtlnmypcrgmzxeuiffup` pertenece a Anclora Nexus (repo distinto) y no se debe usar aquí.
- Si una validación detecta mezcla de `project_ref`, estado obligatorio: `ENV_MISMATCH` y `Decision=NO-GO`.

## Gobernanza NotebookLM (obligatoria)

Toda fuente añadida por MCP a los cuadernos debe respetar el scope temático:

### `ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- Finalidad: escudo jurídico-financiero.
- Solo: fiscalidad autónomo España/Baleares (IAE, IVA, IRPF, RETA, deducciones, inspección, escenarios de facturación).

### `ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- Finalidad: airbag estratégico de transición.
- Solo: pluriactividad, compatibilidades, conflicto contractual/laboral, timing de salida, riesgo reputacional.

### `ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`
- Finalidad: motor comercial del sistema.
- Solo: posicionamiento premium, USP, narrativa estratégica, autoridad comercial y conversión.

Reglas de aceptación MCP:
- Cada fuente debe llevar `notebook_id`, `domain` y `reason_for_fit`.
- Si una fuente no encaja en el cuaderno destino:
  - `SOURCE_SCOPE_MISMATCH`
  - `Decision=NO-GO` para esa tanda de ingesta.

## Comandos útiles
- `npm run dev`: desarrollo local.
- `npm run build`: build de producción.
- `npm run type-check`: validación TypeScript.
- `npm run lint`: lint (requiere ESLint instalado).

## Checklist mínimo antes de merge
- `type-check` sin errores.
- `lint` sin errores.
- Endpoint `/api/chat` responde con contrato esperado.
- Flujo UI principal visible desde `src/app/page.tsx`.
- Variables de entorno documentadas en `.env.example`.
