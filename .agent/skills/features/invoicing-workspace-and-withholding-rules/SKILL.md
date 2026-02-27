---
name: feature-invoicing-workspace-and-withholding-rules
description: "Implementacion y QA de ANCLORA-INV-001 bajo SDD."
---

# Skill - Invoicing Workspace and Withholding Rules v1

## Lecturas obligatorias

1. `AGENTS.md`
2. `.agent/rules/workspace-governance.md`
3. `.agent/rules/feature-invoicing-workspace-and-withholding-rules.md`
4. `sdd/features/invoicing-workspace-and-withholding-rules/invoicing-workspace-and-withholding-rules-spec-v1.md`
5. `sdd/features/invoicing-workspace-and-withholding-rules/invoicing-workspace-and-withholding-rules-test-plan-v1.md`

## Metodo de trabajo

1. Definir contrato de payload para facturas.
2. Implementar API `GET/POST /api/invoices` con validacion y calculo server-side.
3. Implementar UI de formulario y listado en `/dashboard/facturacion`.
4. Cerrar con QA/Gate y actualizar changelog/features.

## Checklist

- RLS preservado por token de usuario.
- Calculos de IVA/IRPF consistentes.
- Manejo de estados: loading, error, empty.
- Checks tecnicos en verde.

