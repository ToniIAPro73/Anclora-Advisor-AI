# Invoice Module Operativo

## Alcance
- Workspace de facturacion operativo dentro de `/dashboard/facturacion`.
- CRUD basico de `invoices` con RLS por usuario.
- Gestion de estados `draft`, `issued` y `paid`.
- Numeracion por serie.
- Vista imprimible lista para PDF.
- Envio real por SMTP con PDF adjunto.

## Endpoints
- `GET /api/invoices`
- `POST /api/invoices`
- `PATCH /api/invoices/[invoiceId]`
- `DELETE /api/invoices/[invoiceId]`
- `GET /api/invoices/[invoiceId]/pdf`
- `POST /api/invoices/[invoiceId]/send`

## UI
- Formulario unico para crear y editar facturas.
- Recalculo automatico de base, IVA, IRPF y total.
- Serie y email destinatario editables.
- Resumen de volumen y estados.
- Lista filtrable con acciones de emitir, marcar pagada, volver a borrador, eliminar, abrir vista PDF y enviar por SMTP.

## Flujo
- Al crear una factura se asigna `series` y `invoice_number`.
- Si no se informa serie, se usa el ano de `issue_date`.
- `Vista PDF` abre un HTML imprimible para guardar como PDF desde navegador.
- `Enviar` genera un PDF real, lo adjunta por SMTP, actualiza `recipient_email`, marca `sent_at` y pasa `draft -> issued` tras envio exitoso.

## Variables de entorno
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

## Nota operativa
- Si SMTP no esta configurado, `POST /api/invoices/[invoiceId]/send` responde `503` con `SMTP_NOT_CONFIGURED`.
- Si el transporte falla, responde `502` con `SMTP_DELIVERY_FAILED`.
