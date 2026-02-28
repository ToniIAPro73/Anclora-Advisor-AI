# Invoice Module Operativo

## Alcance
- Workspace de facturacion operativo dentro de `/dashboard/facturacion`.
- CRUD basico de `invoices` con RLS por usuario.
- Gestion de estados `draft`, `issued` y `paid`.

## Endpoints
- `GET /api/invoices`
- `POST /api/invoices`
- `PATCH /api/invoices/[invoiceId]`
- `DELETE /api/invoices/[invoiceId]`

## UI
- Formulario unico para crear y editar facturas.
- Recalculo automatico de base, IVA, IRPF y total.
- Resumen de volumen y estados.
- Lista filtrable con acciones de emitir, marcar pagada, volver a borrador y eliminar.

## Limite actual
- No hay numeracion de series, PDF ni envio por email.
- Si quieres modulo de facturacion completo, esos tres puntos son el siguiente bloque natural.
