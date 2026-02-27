# Core Changelog

## 2026-02-25

- Inicializacion de estructura SDD core para Anclora Advisor AI.

## 2026-02-26

- Se define roadmap de entrega frontend por fases en `sdd/features/frontend-app-delivery-roadmap-v1.md`.
- Se actualiza `sdd/features/FEATURES.md` con backlog de features planificadas y estado `PLANNED/PENDING`.
- Se fija el marco de ejecucion por feature hasta cierre con `QA_REPORT` + `GATE_FINAL` en GO.

## 2026-02-27

- Feature `ANCLORA-AUTH-001` completada con estado `CLOSED/GO`.
- Se implementa autenticacion base con Supabase en `/login` y sesion servidor en `/api/auth/session`.
- Se activa proteccion de rutas `/dashboard/*` via `src/middleware.ts`.
- Se agregan artefactos SDD de la feature (`rule`, `skill`, `prompts`, `spec`, `test-plan`, `QA_REPORT`, `GATE_FINAL`).
- Feature `ANCLORA-DSH-001` completada con estado `CLOSED/GO`.
- Se implementa shell de dashboard con sidebar, topbar y sistema visual de marca.
- Se integran `Logo-Advisor.png` y tokens de color basados en la paleta oficial.
- Se agregan artefactos SDD de `dashboard-shell-and-brand-system` (spec/test/qa/gate + prompts/rule/skill).
- Feature `ANCLORA-CHAT-002` completada con estado `CLOSED/GO`.
- Se integra workspace de chat real en `/dashboard/chat` con citas desplegables y alertas criticas.
- Se normaliza parsing del contrato de `/api/chat` en `useChat` para success/error robusto.
- Se agregan artefactos SDD de `chat-rag-workspace-and-citations` (spec/test/qa/gate + prompts/rule/skill).
- Feature `ANCLORA-FISC-001` completada con estado `CLOSED/GO`.
- Se conecta `/dashboard/fiscal` a `fiscal_alerts` en Supabase con cliente scopeado por token de usuario.
- Se implementan widget de Cuota Cero y timeline de modelos 303/130 con estados de prioridad y estado.
- Se agregan artefactos SDD de `fiscal-panel-and-tax-timeline` (spec/test/qa/gate + prompts/rule/skill).
- Se crea infraestructura SDD de `ANCLORA-RAG-INGEST-001` para ejecucion por Antigravity (sin implementacion runtime).
- Se agregan prompts por agentes para acceso MCP a 3 cuadernos NotebookLM, ingesta, embeddings y QA/Gate.
- Se endurece gobernanza global de entorno Supabase:
  - politica de `project_ref` unico,
  - bloqueo `NO-GO` por conflicto de refs,
  - preflight reutilizable en `.antigravity/prompts/features/_supabase-env-preflight.md`.
- Se agrega hardening de infraestructura RAG en Supabase:
  - nueva migracion idempotente `supabase/migrations/20260227_rag_infra_hardening.sql`,
  - script `rag:infra:apply` para aplicar SQL completo por conexion DB,
  - script `rag:infra:verify` para validar tablas, embeddings y RPC `match_chunks`.
- Se cierra `ANCLORA-RAG-INGEST-001` en `CLOSED/GO`:
  - migracion RAG aplicada en Supabase Advisor (`lvpplnqbyvscpuljnzqf`),
  - verificacion de infraestructura en GO,
  - test de integracion retrieval/chat grounding en PASS (11/11).
- Feature `ANCLORA-LAB-001` completada con estado `CLOSED/GO`.
- Se implementa `/dashboard/laboral` conectado a `labor_risk_assessments` con RLS por usuario.
- Se muestran score actual, nivel de riesgo, recomendaciones y historial reciente.
- Se agregan artefactos SDD de `labor-risk-monitor-and-history` (rule/skill/prompts/spec/test/qa/gate).
- Feature `ANCLORA-INV-001` completada con estado `CLOSED/GO`.
- Se implementa `/dashboard/facturacion` con formulario operativo, calculo IVA/IRPF y listado historico.
- Se agrega API `GET/POST /api/invoices` con validacion de payload y persistencia segura por sesion.
- Se agregan artefactos SDD de `invoicing-workspace-and-withholding-rules` (rule/skill/prompts/spec/test/qa/gate).
