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
