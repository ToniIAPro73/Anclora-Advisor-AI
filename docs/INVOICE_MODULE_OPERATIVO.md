# Invoice Module Operativo

## Alcance
- Workspace de facturacion operativo dentro de `/dashboard/facturacion`.
- CRUD basico de `invoices` con RLS por usuario.
- Gestion de estados `draft`, `issued` y `paid`.
- Numeracion por serie.
- Duplicado de facturas como nuevo borrador.
- Vista imprimible lista para PDF.
- Envio real por SMTP con PDF adjunto via outbox y job queue.
- Exportacion del libro visible en CSV y JSON.
- Seguimiento de cobro con fecha, metodo, referencia y notas.
- Cobros parciales con historico por factura.

## Endpoints
- `GET /api/invoices`
- `POST /api/invoices`
- `PATCH /api/invoices/[invoiceId]`
- `DELETE /api/invoices/[invoiceId]`
- `POST /api/invoices/[invoiceId]/duplicate`
- `GET /api/invoices/export`
- `GET /api/invoices/[invoiceId]/pdf`
- `POST /api/invoices/[invoiceId]/send`
- `GET /api/invoices/[invoiceId]/payments`
- `POST /api/invoices/[invoiceId]/payments`
- `DELETE /api/invoice-payments/[paymentId]`
- `GET /api/operations/jobs`
- `POST /api/operations/jobs`

## UI
- Formulario unico para crear y editar facturas.
- Recalculo automatico de base, IVA, IRPF y total.
- Serie y email destinatario editables.
- Resumen de volumen y estados.
- Libro de facturas agrupado por periodo y estado.
- Lista filtrable con acciones de emitir, marcar pagada, volver a borrador, eliminar, abrir vista PDF, encolar envios y procesar cola.
- Registro de cobro desde listado o formulario de edicion.
- Registro de cobros parciales sobre la factura seleccionada.
- Accion de duplicar factura desde listado.
- Filtros avanzados por cliente/NIF, serie, estado y rango de fechas.
- Resumen de volumen total, cobrado y pendiente de cobro.

## Flujo
- Al crear una factura se asigna `series` y `invoice_number`.
- Si no se informa serie, se usa el ano de `issue_date`.
- `Vista PDF` abre un HTML imprimible para guardar como PDF desde navegador.
- `Enviar` crea un registro en `email_outbox` y un `app_job`.
- `Procesar cola` ejecuta jobs pendientes del usuario actual.
- Solo cuando el job termina con exito se actualizan `recipient_email`, `sent_at` y `draft -> issued`.
- `Registrar cobro` actualiza `paid_at`, `payment_method`, `payment_reference` y deja trazabilidad operativa.
- Cada cobro parcial se guarda en `invoice_payments`.
- La factura pasa a `paid` solo cuando la suma de cobros alcanza el total.

## Variables de entorno
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

## Nota operativa
- Si SMTP no esta configurado, el enqueue se rechaza con `503` y los jobs existentes no podran completarse.
- `ops:process` permite procesar la cola desde CLI.
- La cola actual ya soporta reintentos y outbox, pero no tiene aun worker persistente separado del runtime web.
