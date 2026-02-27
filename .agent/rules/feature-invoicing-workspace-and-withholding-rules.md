---
trigger: always_on
---

# Feature Rule - Invoicing Workspace and Withholding Rules

Feature ID: `ANCLORA-INV-001`

## Alcance v1

- Implementar `/dashboard/facturacion` con formulario operativo de factura.
- Calcular total con IVA e IRPF (retencion) en cliente y servidor.
- Persistir facturas en `invoices` bajo contexto autenticado y RLS.
- Mostrar historial reciente de facturas.

## Restricciones

- No exponer secretos en cliente.
- No permitir insercion con `user_id` externo al usuario autenticado.
- No romper layout dashboard sin scroll vertical global.

## Definition of Done

- Spec y test-plan completados.
- API `GET/POST /api/invoices` funcional.
- UI de facturacion operativa en dashboard.
- QA report y Gate Final en GO.

