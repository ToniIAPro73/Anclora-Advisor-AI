<!-- ANCLORA-ECOSYSTEM-CONTEXT-START -->
## Contexto de ecosistema Anclora

Antes de modificar este repositorio, todo agente debe leer:

- `.anclora/global/ANCLORA_ECOSYSTEM_CONTEXT.md`
- `.anclora/global/GLOBAL_AGENT_WORKFLOW.md`
- `.anclora/AGENT_PROJECT_CONTEXT.md`
- `MEMORY.md`

La arquitectura estable del ecosistema se define en:

`anclora-vault/00-governance/contracts/core/ANCLORA_ECOSYSTEM_ARCHITECTURE_CONTRACT.md` (renombrado desde `Boveda-Anclora`)

No asumir infraestructura compartida entre productos. Validar siempre hosting, backend, base de datos, auth, variables y ramas.
<!-- ANCLORA-ECOSYSTEM-CONTEXT-END -->

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

<!-- ANCLORA-SDD-STANDARDS-START -->
## Metodología SDD — Estándar Unificado Anclora

Todo desarrollo en este repo sigue la metodología SDD unificada del ecosistema Anclora.

**Referencia canónica**: `agency-agents/docs/guides/SDD_INTEGRATION_GUIDE.md`
**Workflow OpenSpec**: `agency-agents/docs/guides/OPENSPEC_WORKFLOW.md`

### Flujo de trabajo Git

- Rama base de desarrollo: **`development`**
- Los agentes crean ramas desde `development`: `feat/<agente>-<descripcion>`, `fix/...`, `chore/...`
- Las ramas se mergean de vuelta a `development` via PR
- Promoción manual: `development → staging → production → main`
- Nunca commitear directamente en `main`, `staging` ni `production`

### Principios de desarrollo (Specboot)

1. **Small Tasks, One at a Time** — baby steps, nunca saltarse pasos
2. **Test-Driven Development** — escribir tests fallidos antes de implementar
3. **Type Safety** — código completamente tipado (TypeScript)
4. **Clear Naming** — variables y funciones descriptivas
5. **English Only** — código, comentarios y docs técnicos en inglés
6. **90% Test Coverage** — cobertura exhaustiva en todas las capas
7. **Incremental Changes** — modificaciones focalizadas y revisables

### Ciclo de cambios (SDD en este repo)

Toda feature o fix sigue este flujo antes de escribir código:

- Crear spec: `sdd/features/<nombre>/<nombre>-spec-v1.md`
- Crear plan: `sdd/features/<nombre>/<nombre>-plan-v1.md` (cambios complejos)
- Crear tasks: `sdd/features/<nombre>/<nombre>-tasks-v1.md`
- Implementar tarea a tarea (tests primero)
- Validar contra criterios de aceptación de la spec
- PR contra `development`, con referencia a la spec

### Reglas obligatorias

- **No spec, no code**: toda feature empieza con spec en `sdd/features/`
- **Tests primero**: el agente ejecuta los tests, nunca el usuario
- **Hermes gate**: cambio que afecta copy público → Hermes Copy Curator antes del merge
- **Spec inmutable**: una spec cerrada no se edita; los cambios generan una spec nueva
<!-- ANCLORA-SDD-STANDARDS-END -->
