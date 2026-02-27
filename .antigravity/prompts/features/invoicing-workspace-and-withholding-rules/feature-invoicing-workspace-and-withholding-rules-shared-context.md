# Shared Context - invoicing-workspace-and-withholding-rules

Feature ID: `ANCLORA-INV-001`

- Tabla objetivo: `public.invoices`
- Campos clave: `client_name`, `client_nif`, `amount_base`, `iva_rate`, `irpf_retention`, `total_amount`, `issue_date`, `status`
- Regla: `user_id` siempre se deriva de sesion autenticada (no del cliente)

