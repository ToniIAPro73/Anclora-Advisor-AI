# Frontend App Delivery Roadmap v1

Fecha: 2026-02-26  
Producto: Anclora Advisor AI

## Objetivo

Definir un plan por fases para construir la aplicacion completa siguiendo:

1. `docs/Diseño y Arquitectura Frontend.md`
2. Sistema SDD del workspace (`rules`, `skills`, `prompts`, `specs`)
3. Patrones visuales/estructurales de `../anclora-nexus/frontend`

## Referencias de Anclora Nexus usadas

- Estructura de layout protegida: `frontend/src/app/(dashboard)/layout.tsx`
- Sidebar modular: `frontend/src/components/layout/Sidebar.tsx`
- Header/Topbar: `frontend/src/components/layout/Header.tsx`
- Sistema de tokens visuales: `frontend/src/app/globals.css`
- Login premium: `frontend/src/app/login/page.tsx`

## Regla de ejecucion por feature (obligatoria)

Para cerrar cada feature con `GATE FINAL = GO`:

1. Rule de feature en `.agent/rules/feature-<feature>.md`
2. Skill de feature en `.agent/skills/features/<feature>/SKILL.md`
3. Prompts de feature en `.antigravity/prompts/features/<feature>/`
4. Spec/Test plan en `sdd/features/<feature>/`
5. Implementacion por capas: DB -> backend -> frontend -> QA
6. Checks: `npm run -s lint`, `npm run -s type-check`, `npm run -s build`
7. QA report + Gate final: `QA_REPORT_<ID>.md` y `GATE_FINAL_<ID>.md`
8. Actualizar `sdd/features/FEATURES.md` y `sdd/core/CHANGELOG.md`

## Fases y features

## Matriz de artefactos por feature

Para cada feature, crear exactamente estos artefactos:

| Feature slug | Rule | Skill | Prompt folder | Spec folder |
| --- | --- | --- | --- | --- |
| `auth-session-and-route-guard` | `.agent/rules/feature-auth-session-and-route-guard.md` | `.agent/skills/features/auth-session-and-route-guard/SKILL.md` | `.antigravity/prompts/features/auth-session-and-route-guard/` | `sdd/features/auth-session-and-route-guard/` |
| `dashboard-shell-and-brand-system` | `.agent/rules/feature-dashboard-shell-and-brand-system.md` | `.agent/skills/features/dashboard-shell-and-brand-system/SKILL.md` | `.antigravity/prompts/features/dashboard-shell-and-brand-system/` | `sdd/features/dashboard-shell-and-brand-system/` |
| `chat-rag-workspace-and-citations` | `.agent/rules/feature-chat-rag-workspace-and-citations.md` | `.agent/skills/features/chat-rag-workspace-and-citations/SKILL.md` | `.antigravity/prompts/features/chat-rag-workspace-and-citations/` | `sdd/features/chat-rag-workspace-and-citations/` |
| `fiscal-panel-and-tax-timeline` | `.agent/rules/feature-fiscal-panel-and-tax-timeline.md` | `.agent/skills/features/fiscal-panel-and-tax-timeline/SKILL.md` | `.antigravity/prompts/features/fiscal-panel-and-tax-timeline/` | `sdd/features/fiscal-panel-and-tax-timeline/` |
| `rag-ingestion-and-notebooklm-sync` | `.agent/rules/feature-rag-ingestion-and-notebooklm-sync.md` | `.agent/skills/features/rag-ingestion-and-notebooklm-sync/SKILL.md` | `.antigravity/prompts/features/rag-ingestion-and-notebooklm-sync/` | `sdd/features/rag-ingestion-and-notebooklm-sync/` |
| `labor-risk-monitor-and-history` | `.agent/rules/feature-labor-risk-monitor-and-history.md` | `.agent/skills/features/labor-risk-monitor-and-history/SKILL.md` | `.antigravity/prompts/features/labor-risk-monitor-and-history/` | `sdd/features/labor-risk-monitor-and-history/` |
| `invoicing-workspace-and-withholding-rules` | `.agent/rules/feature-invoicing-workspace-and-withholding-rules.md` | `.agent/skills/features/invoicing-workspace-and-withholding-rules/SKILL.md` | `.antigravity/prompts/features/invoicing-workspace-and-withholding-rules/` | `sdd/features/invoicing-workspace-and-withholding-rules/` |
| `i18n-observability-and-release-hardening` | `.agent/rules/feature-i18n-observability-and-release-hardening.md` | `.agent/skills/features/i18n-observability-and-release-hardening/SKILL.md` | `.antigravity/prompts/features/i18n-observability-and-release-hardening/` | `sdd/features/i18n-observability-and-release-hardening/` |

### Fase A - Acceso y seguridad base

Feature: `auth-session-and-route-guard`  
Feature ID: `ANCLORA-AUTH-001`

Alcance:

- Rutas `/`, `/login`, `/dashboard/*` con redireccion por sesion.
- `src/middleware.ts` para proteger dashboard con Supabase Auth.
- Login/Register/Logout con UX alineada a marca.
- Variables de entorno publicas/privadas normalizadas y documentadas.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `supabase-data-quality-and-rls`
- `conversation-ux-and-accessibility`

Gate de salida:

- Sin acceso anonimo a `/dashboard/*`.
- Flujo login/logout funcional.
- `ENV_MISMATCH = none`.

### Fase B - Shell de dashboard y design system

Feature: `dashboard-shell-and-brand-system`  
Feature ID: `ANCLORA-DSH-001`

Alcance:

- `DashboardLayout` con Sidebar + Topbar + Main content.
- Integracion de logo `public/brand/Logo-Advisor.png`.
- Tokens de color desde `public/brand/Paleta-Advisor.png` y documento de diseno.
- Navegacion inicial: Chat, Fiscal, Laboral, Facturacion.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `conversation-ux-and-accessibility`

Gate de salida:

- Navegacion y layout responsive desktop/mobile.
- Identidad visual consistente con paleta y tipografia.

### Fase C - Workspace de chat RAG

Feature: `chat-rag-workspace-and-citations`  
Feature ID: `ANCLORA-CHAT-002`

Alcance:

- Integrar `ChatInterface` dentro de `/dashboard/chat`.
- Bloque de citas/fuentes desplegable por respuesta.
- Tarjetas de alerta critica inyectadas en stream.
- Contrato `/api/chat` estable con metadata para UI.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `rag-grounding-and-citations`
- `conversation-ux-and-accessibility`
- `observability-and-error-intelligence`

Gate de salida:

- Happy path + error path + alerts en UI.
- Sin regresion del contrato API.

### Fase D - Panel fiscal operativo

Feature: `fiscal-panel-and-tax-timeline`  
Feature ID: `ANCLORA-FISC-001`

Alcance:

- Vista `/dashboard/fiscal`.
- Widget Cuota Cero (estado ano 1/ano 2).
- Timeline de vencimientos (Modelo 303 y 130).
- Estados de carga, vacio y error.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `supabase-data-quality-and-rls`

Gate de salida:

- Datos fiscales solo del usuario autenticado (RLS).
- Fechas y estados renderizados sin errores de timezone.

### Fase D.5 - Ingesta de conocimiento RAG

Feature: `rag-ingestion-and-notebooklm-sync`  
Feature ID: `ANCLORA-RAG-INGEST-001`

Alcance:

- Ingesta de 3 cuadernos NotebookLM via MCP.
- Normalizacion, chunking y embeddings (384 dims).
- Carga en `rag_documents`/`rag_chunks` para grounding del chat.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `rag-grounding-and-citations`
- `supabase-data-quality-and-rls`

Gate de salida:

- 3 cuadernos ingeridos y trazables.
- Retrieval con citas verificables en chat.
- QA y gate final en GO tras ejecucion real.

### Fase E - Monitor laboral

Feature: `labor-risk-monitor-and-history`  
Feature ID: `ANCLORA-LAB-001`

Alcance:

- Vista `/dashboard/laboral`.
- Risk score (0.00-1.00) con visualizacion clara.
- Historial de evaluaciones y recomendaciones.
- Vinculo con alertas del chat para continuidad operativa.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `conversation-ux-and-accessibility`
- `observability-and-error-intelligence`

Gate de salida:

- Score y recomendaciones consistentes con datos persistidos.
- Sin regresion de accesibilidad en controles clave.

### Fase F - Facturacion y retenciones

Feature: `invoicing-workspace-and-withholding-rules`  
Feature ID: `ANCLORA-INV-001`

Alcance:

- Vista `/dashboard/facturacion`.
- Formulario para generar factura con retenciones.
- Persistencia segura en Supabase.
- Validaciones de dominio y estados de confirmacion/error.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `supabase-data-quality-and-rls`

Gate de salida:

- Factura calculada y guardada correctamente.
- Sin exponer claves ni log de datos sensibles.

### Fase G - Cierre transversal de release

Feature: `i18n-observability-and-release-hardening`  
Feature ID: `ANCLORA-HARD-001`

Alcance:

- Validacion i18n `es/en` de textos nuevos.
- Logging estructurado sin PII y trazabilidad por request.
- Test de humo E2E sobre rutas principales.
- Checklist final de compliance SDD para release.

Skills recomendadas:

- `spec-driven-feature-delivery`
- `observability-and-error-intelligence`

Gate de salida:

- Todos los features previos en `CLOSED/GO`.
- Sin bloqueantes P0/P1 abiertos.

## Orden de ejecucion recomendado

1. `ANCLORA-AUTH-001`
2. `ANCLORA-DSH-001`
3. `ANCLORA-CHAT-002`
4. `ANCLORA-FISC-001`
5. `ANCLORA-RAG-INGEST-001`
6. `ANCLORA-LAB-001`
7. `ANCLORA-INV-001`
8. `ANCLORA-HARD-001`

## Riesgos criticos y mitigacion

- Riesgo: desalineacion entre UX objetivo y contrato backend.
  Mitigacion: congelar contrato en spec antes de tocar UI.
- Riesgo: errores de seguridad por mezcla de variables publicas/privadas.
  Mitigacion: revisar `.env.example` y `ENV_MISMATCH` en cada QA.
- Riesgo: regression del chat al introducir paneles nuevos.
  Mitigacion: smoke tests por fase sobre `/dashboard/chat` y `/api/chat`.
