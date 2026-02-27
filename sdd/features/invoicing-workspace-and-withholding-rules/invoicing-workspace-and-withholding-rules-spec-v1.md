# invoicing-workspace-and-withholding-rules-spec-v1

Feature ID: `ANCLORA-INV-001`

## 1. Problema

La vista `/dashboard/facturacion` estaba en estado placeholder sin flujo operativo de alta de facturas.

## 2. Objetivo

Entregar un workspace de facturacion con calculo de IVA/IRPF, persistencia segura en Supabase y listado historico por usuario.

## 3. Alcance

- Formulario de factura en dashboard.
- Calculo de total en cliente y servidor.
- API `GET/POST /api/invoices`.
- Listado reciente de facturas del usuario autenticado.

## 4. No alcance

- Emision PDF.
- Envio por email.
- Facturacion multiempresa.

## 5. Requisitos funcionales

- RF1: Crear factura en estado `draft`.
- RF2: Calcular `total_amount` con formula `base + IVA - IRPF`.
- RF3: Persistir con `user_id` de sesion autenticada.
- RF4: Mostrar historial de facturas.
- RF5: Mostrar estados de error y vacio.

## 6. Requisitos no funcionales

- RNF1: Respetar RLS de `invoices`.
- RNF2: Validacion estricta de payload.
- RNF3: UI consistente con dashboard sin scroll vertical global.

## 7. Riesgos

- NIF mal formado por entrada de usuario.
- Divergencia entre previsualizacion cliente y calculo final servidor.

## 8. Criterios de aceptacion

- CA1: Factura se guarda en Supabase sin exponer claves.
- CA2: Total mostrado coincide con total persistido.
- CA3: Historial se actualiza tras alta.
- CA4: Checks tecnicos en verde.

## 9. Plan de pruebas

Ver `invoicing-workspace-and-withholding-rules-test-plan-v1.md`.

