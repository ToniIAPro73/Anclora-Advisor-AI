# Invoice Module Operativo

## Alcance
- Workspace de facturacion operativo dentro de `/dashboard/facturacion`.
- CRUD basico de `invoices` con RLS por usuario.
- Gestion de estados `draft`, `issued` y `paid`.
- Numeracion por serie.
- Vista imprimible lista para PDF.
- Envio asistido por `mailto`.

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
- Lista filtrable con acciones de emitir, marcar pagada, volver a borrador, eliminar, abrir vista PDF y preparar envio.

## Flujo
- Al crear una factura se asigna `series` y `invoice_number`.
- Si no se informa serie, se usa el ano de `issue_date`.
- `Vista PDF` abre un HTML imprimible para guardar como PDF desde navegador.
- `Enviar` actualiza `recipient_email`, marca `sent_at`, fuerza estado `issued` y abre el cliente de correo con `mailto`.

## Nota operativa
- El envio actual es asistido, no SMTP server-side.
- Si se quiere envio real desde backend, el siguiente paso es integrar proveedor transaccional y adjunto PDF binario.
