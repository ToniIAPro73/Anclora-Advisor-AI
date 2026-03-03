# Facturacion V7

Se añaden dos features nuevas al módulo `/dashboard/facturacion`.

## 1. Envio a Verifactu

- Nueva ruta: `POST /api/invoices/[invoiceId]/verifactu`
- Modelo ampliado en `invoices`:
  - `verifactu_status`
  - `verifactu_submitted_at`
  - `verifactu_submission_id`
  - `verifactu_last_error`
- El envio se encola en `app_jobs` con `job_kind=invoice_verifactu_submission`
- El procesador operativo usa:
  - `VERIFACTU_ENDPOINT_URL`
  - `VERIFACTU_API_TOKEN`
  - `VERIFACTU_SYSTEM_ID`

## 2. Importacion de facturas PDF

- Nueva ruta: `POST /api/invoices/import-pdf`
- Bucket privado Supabase: `invoice-imports`
- La app:
  - sube el PDF original al bucket
  - extrae texto del PDF
  - intenta detectar cliente, NIF, fecha, base, IVA, IRPF y total
  - crea automaticamente una factura en estado `issued`
- Modelo ampliado en `invoices`:
  - `import_source`
  - `import_file_name`
  - `import_storage_path`
  - `import_confidence`
  - `imported_at`

## Provisioning

1. `npm run invoice:workflow:v7:apply`
2. `npm run invoice:storage:apply`

## Limitaciones

- Verifactu requiere endpoint/token reales.
- La importacion PDF es fiable para PDFs textuales; no hace OCR de documentos escaneados.
