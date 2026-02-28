# Audit Trail

## Alcance
- Auditoria operativa por usuario para:
  - fiscal
  - laboral
  - facturacion

## Infraestructura
- Tabla: `public.app_audit_logs`
- Script de aplicacion: `npm run audit:apply`

## Endpoints
- `GET /api/audit-logs?domain=fiscal|labor|invoices&limit=8`

## Eventos auditados
- Fiscal:
  - crear/editar/eliminar alertas
  - crear/editar/eliminar plantillas
  - encolar generacion recurrente
- Laboral:
  - crear/editar/eliminar evaluaciones
  - crear/editar/eliminar mitigaciones
- Facturacion:
  - crear/editar/eliminar facturas
  - encolar envio por email

## UI
- Cada modulo muestra una timeline de auditoria reciente dentro de su propio workspace.
