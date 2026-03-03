# Esquema de Base de Datos de Facturación

Este documento resume la estructura de base de datos asociada al módulo de facturación en este repo.

Proyecto Supabase canónico: `lvpplnqbyvscpuljnzqf`

## Resumen

El módulo de facturación se apoya en cuatro piezas principales:

1. `public.invoices`
2. `public.invoice_payments`
3. `public.app_jobs`
4. `public.email_outbox`

Además, para la feature de importación PDF existe un bucket privado de Storage:

- `invoice-imports`

## 1. Tabla `public.invoices`

Tabla principal de facturas por usuario.

### Columnas base

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no |  | FK a `public.users(id)` |
| `client_name` | `varchar(255)` | no |  | Nombre cliente |
| `client_nif` | `varchar(50)` | no |  | NIF/CIF/VAT cliente |
| `amount_base` | `decimal(10,2)` | no |  | Base imponible |
| `iva_rate` | `decimal(4,2)` | no | `21.00` | % IVA |
| `irpf_retention` | `decimal(4,2)` | no | `15.00` | % retención IRPF |
| `total_amount` | `decimal(10,2)` | no |  | Total factura |
| `issue_date` | `date` | no |  | Fecha emisión |
| `status` | `varchar(50)` | no | `'draft'` | Flujo funcional: `draft`, `issued`, `paid` |
| `created_at` | `timestamp` | no | `current_timestamp` | Alta |
| `updated_at` | `timestamp` | no | `current_timestamp` | Última actualización |

### Extensión v3 series y entrega

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `series` | `varchar(20)` | sí |  | Serie de numeración |
| `invoice_number` | `integer` | sí |  | Número correlativo por `user_id + series` |
| `recipient_email` | `varchar(255)` | sí |  | Email de entrega |
| `sent_at` | `timestamp` | sí |  | Fecha/hora de envío |

### Extensión v4 cobro

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `paid_at` | `timestamptz` | sí |  | Fecha/hora de cobro |
| `payment_method` | `text` | sí |  | Método de cobro |
| `payment_reference` | `text` | sí |  | Referencia de cobro |
| `payment_notes` | `text` | sí |  | Notas operativas |

### Extensión v6 rectificativas

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `invoice_type` | `text` | no | `'standard'` | `standard`, `rectificative` |
| `rectifies_invoice_id` | `uuid` | sí |  | FK a `public.invoices(id)` |
| `rectification_reason` | `text` | sí |  | Motivo rectificación |

### Extensión v7/v8 Verifactu e importación documental

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `verifactu_status` | `text` | no | `'not_sent'` | `not_sent`, `queued`, `submitted`, `failed` |
| `verifactu_submitted_at` | `timestamp` | sí |  | Fecha/hora de confirmación |
| `verifactu_submission_id` | `text` | sí |  | Id externo de envío |
| `verifactu_last_error` | `text` | sí |  | Último error conocido |
| `import_source` | `text` | no | `'manual'` | `manual`, `pdf_import`, `image_import` |
| `import_file_name` | `text` | sí |  | Nombre del documento origen |
| `import_storage_path` | `text` | sí |  | Ruta del documento en Storage |
| `import_confidence` | `numeric(5,2)` | sí |  | Confianza heurística de extracción |
| `imported_at` | `timestamp` | sí |  | Fecha/hora de importación |

### Constraints

| Constraint | Tipo | Definición |
|---|---|---|
| `invoices_verifactu_status_allowed` | `CHECK` | `verifactu_status in ('not_sent', 'queued', 'submitted', 'failed')` |
| `invoices_import_source_allowed` | `CHECK` | `import_source in ('manual', 'pdf_import', 'image_import')` |

### Índices

| Índice | Columnas | Notas |
|---|---|---|
| `idx_invoices_user` | `(user_id)` | Base |
| `idx_invoices_user_series` | `(user_id, series)` | Búsqueda por serie |
| `idx_invoices_user_series_number` | `(user_id, series, invoice_number)` | Único parcial cuando `invoice_number is not null` |
| `idx_invoices_paid_at` | `(paid_at desc nulls last)` | Cobros |
| `idx_invoices_rectifies_invoice_id` | `(rectifies_invoice_id)` | Facturas rectificadas |
| `idx_invoices_verifactu_status` | `(user_id, verifactu_status, created_at desc)` | Seguimiento Verifactu |
| `idx_invoices_import_source` | `(user_id, import_source, created_at desc)` | Seguimiento importaciones |

### Relaciones

| Origen | Destino | Tipo |
|---|---|---|
| `invoices.user_id` | `users.id` | N:1 |
| `invoices.rectifies_invoice_id` | `invoices.id` | N:1 autoreferencia |

### RLS

- `ALTER TABLE invoices ENABLE ROW LEVEL SECURITY`
- Policy: `invoice_data_policy`
- Regla: `FOR ALL USING (user_id = auth.uid())`

## 2. Tabla `public.invoice_payments`

Detalle de cobros parciales o completos asociados a facturas.

### Columnas

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `invoice_id` | `uuid` | no |  | FK a `public.invoices(id)` |
| `user_id` | `uuid` | no |  | FK a `public.users(id)` |
| `amount` | `numeric(10,2)` | no |  | `CHECK (amount > 0)` |
| `paid_at` | `timestamptz` | no |  | Fecha/hora del cobro |
| `payment_method` | `text` | sí |  | Método |
| `payment_reference` | `text` | sí |  | Referencia |
| `notes` | `text` | sí |  | Notas |
| `created_at` | `timestamptz` | no | `now()` | Alta |

### Índices

| Índice | Columnas |
|---|---|
| `idx_invoice_payments_invoice` | `(invoice_id, paid_at desc)` |
| `idx_invoice_payments_user` | `(user_id, created_at desc)` |

### Relaciones

| Origen | Destino | Tipo |
|---|---|---|
| `invoice_payments.invoice_id` | `invoices.id` | N:1 |
| `invoice_payments.user_id` | `users.id` | N:1 |

## 3. Tabla `public.app_jobs`

Cola operativa general usada por facturación y otros módulos.

En facturación se usa para:

- `invoice_email_delivery`
- `invoice_verifactu_submission`

### Columnas

| Columna | Tipo | Nulo | Default |
|---|---|---:|---|
| `id` | `uuid` | no | `gen_random_uuid()` |
| `user_id` | `uuid` | no |  |
| `job_kind` | `varchar(100)` | no |  |
| `status` | `varchar(20)` | no | `'pending'` |
| `payload` | `jsonb` | no | `'{}'::jsonb` |
| `result` | `jsonb` | no | `'{}'::jsonb` |
| `attempts` | `integer` | no | `0` |
| `max_attempts` | `integer` | no | `3` |
| `run_after` | `timestamp` | no | `current_timestamp` |
| `started_at` | `timestamp` | sí |  |
| `finished_at` | `timestamp` | sí |  |
| `error_message` | `text` | sí |  |
| `created_at` | `timestamp` | no | `current_timestamp` |
| `updated_at` | `timestamp` | no | `current_timestamp` |

### Índices

| Índice | Columnas |
|---|---|
| `idx_app_jobs_user_status` | `(user_id, status, created_at desc)` |
| `idx_app_jobs_kind_status` | `(job_kind, status, run_after)` |

### RLS

- `ALTER TABLE public.app_jobs ENABLE ROW LEVEL SECURITY`
- Policy: `app_jobs_self_policy`
- Regla: `FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`

## 4. Tabla `public.email_outbox`

Outbox de entregas por email. Asociada al envío de facturas.

### Columnas

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no |  | FK a `public.users(id)` |
| `app_job_id` | `uuid` | no |  | FK a `public.app_jobs(id)` |
| `invoice_id` | `uuid` | sí |  | FK a `public.invoices(id)` |
| `recipient_email` | `varchar(255)` | no |  | Destinatario |
| `subject` | `varchar(500)` | no |  | Asunto |
| `status` | `varchar(20)` | no | `'queued'` | `queued`, `sent`, `failed` |
| `provider_message_id` | `varchar(255)` | sí |  | Id proveedor SMTP |
| `last_error` | `text` | sí |  | Error |
| `sent_at` | `timestamp` | sí |  | Fecha/hora envío |
| `created_at` | `timestamp` | no | `current_timestamp` | Alta |
| `updated_at` | `timestamp` | no | `current_timestamp` | Última actualización |

### Índices

| Índice | Columnas |
|---|---|
| `idx_email_outbox_user_status` | `(user_id, status, created_at desc)` |
| `idx_email_outbox_job_id` | `(app_job_id)` |

### Relaciones

| Origen | Destino | Tipo |
|---|---|---|
| `email_outbox.user_id` | `users.id` | N:1 |
| `email_outbox.app_job_id` | `app_jobs.id` | N:1 |
| `email_outbox.invoice_id` | `invoices.id` | N:1 |

### RLS

- `ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY`
- Policy: `email_outbox_self_policy`
- Regla: `FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`

## 5. Storage asociado

### Bucket `invoice-imports`

Uso:

- guardar el documento original importado
- mantener trazabilidad del origen documental de la factura

Configuración esperada:

- bucket privado
- `fileSizeLimit`: `10 MB`
- `allowedMimeTypes`: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`

La ruta física se referencia desde:

- `invoices.import_storage_path`

## 6. Diagrama lógico rápido

```text
users
  └─< invoices
       ├─< invoice_payments
       ├─< email_outbox
       └─< app_jobs (indirecto por payload / flujo operativo)

app_jobs
  └─< email_outbox
```

## 7. Flujos soportados

### Alta manual

- Inserta en `invoices`
- Estado inicial habitual: `draft`

### Cobro parcial

- Inserta en `invoice_payments`
- Recalcula estado de `invoices`

### Envío email

1. Inserta job en `app_jobs` con `job_kind=invoice_email_delivery`
2. Inserta registro en `email_outbox`
3. El procesador actualiza `invoices.sent_at` y, si procede, `status='issued'`

### Envío Verifactu

1. Inserta job en `app_jobs` con `job_kind=invoice_verifactu_submission`
2. Marca `invoices.verifactu_status='queued'`
3. El procesador actualiza:
   - `verifactu_status='submitted'`
   - `verifactu_submitted_at`
   - `verifactu_submission_id`
   - `verifactu_last_error`

### Importación PDF

1. Sube el PDF al bucket `invoice-imports`
2. Inserta una factura en `invoices`
3. Marca:
   - `import_source='pdf_import'`
   - `import_file_name`
   - `import_storage_path`
   - `import_confidence`
   - `imported_at`

## 8. Migraciones implicadas

| Migración | Propósito |
|---|---|
| `20260225235038_initial_schema.sql` | tabla base `invoices` + RLS |
| `20260228_invoice_series_delivery.sql` | series, numeración, email y `sent_at` |
| `20260301_invoice_payment_v4.sql` | datos de cobro en cabecera factura |
| `20260301_invoice_partial_payments_v5.sql` | tabla `invoice_payments` |
| `20260301_invoice_rectifications_v6.sql` | facturas rectificativas |
| `20260228_operations_outbox_jobs.sql` | `app_jobs` + `email_outbox` |
| `20260303_invoice_verifactu_pdf_import_v7.sql` | Verifactu + importación PDF |
