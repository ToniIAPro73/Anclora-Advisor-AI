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

## 2. Importacion documental de facturas

- Nueva ruta: `POST /api/invoices/import-pdf`
- Bucket privado Supabase: `invoice-imports`
- La app:
  - sube el documento original al bucket
  - si el PDF es textual, intenta parsearlo sin OCR
  - si el documento es una imagen, o el PDF no ofrece texto fiable, puede usar un VLM
  - intenta detectar cliente/destinatario, NIF, fecha, base, IVA, IRPF y total
  - crea automaticamente una factura en estado `issued`
- Modelo ampliado en `invoices`:
  - `import_source`
  - `import_file_name`
  - `import_storage_path`
  - `import_confidence`
  - `imported_at`

## Provisioning

1. `npm run invoice:workflow:v7:apply`
2. `npm run invoice:workflow:v8:apply`
3. `npm run invoice:storage:apply`

## Limitaciones

- Verifactu requiere endpoint/token reales.
- El fallback VLM requiere `INVOICE_IMPORT_VLM_ENABLED=true`, `ZAI_API_KEY` y opcionalmente `ZAI_VISION_MODEL`.
- El fallback VLM para PDFs escaneados necesita conversión del PDF a imagen mediante `pdftoppm` o `magick` disponible en el host.
