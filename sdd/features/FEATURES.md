# Features Index

- [chat-response-reliability-and-safety](./chat-response-reliability-and-safety/chat-response-reliability-and-safety-INDEX.md)
- [auth-session-and-route-guard](./auth-session-and-route-guard/auth-session-and-route-guard-INDEX.md)
- [dashboard-shell-and-brand-system](./dashboard-shell-and-brand-system/dashboard-shell-and-brand-system-INDEX.md)
- [chat-rag-workspace-and-citations](./chat-rag-workspace-and-citations/chat-rag-workspace-and-citations-INDEX.md)
- [fiscal-panel-and-tax-timeline](./fiscal-panel-and-tax-timeline/fiscal-panel-and-tax-timeline-INDEX.md)
- [rag-ingestion-and-notebooklm-sync](./rag-ingestion-and-notebooklm-sync/rag-ingestion-and-notebooklm-sync-INDEX.md)
- [labor-risk-monitor-and-history](./labor-risk-monitor-and-history/labor-risk-monitor-and-history-INDEX.md)
- [frontend-app-delivery-roadmap-v1](./frontend-app-delivery-roadmap-v1.md)

## Delivery Status

| Feature                                      | Status   | Gate    |
| -------------------------------------------- | -------- | ------- |
| chat-response-reliability-and-safety         | CLOSED   | GO      |
| auth-session-and-route-guard                 | CLOSED   | GO      |
| dashboard-shell-and-brand-system             | CLOSED   | GO      |
| chat-rag-workspace-and-citations             | CLOSED   | GO      |
| fiscal-panel-and-tax-timeline                | CLOSED   | GO      |
| rag-ingestion-and-notebooklm-sync            | CLOSED   | GO      |
| labor-risk-monitor-and-history               | CLOSED   | GO      |
| invoicing-workspace-and-withholding-rules    | PLANNED  | PENDING |
| i18n-observability-and-release-hardening     | PLANNED  | PENDING |

## Notes

- `rag-ingestion-and-notebooklm-sync` dispone de hardening operativo de Supabase en:
  - `supabase/migrations/20260227_rag_infra_hardening.sql`
  - `npm run rag:infra:apply`
  - `npm run rag:infra:verify`
