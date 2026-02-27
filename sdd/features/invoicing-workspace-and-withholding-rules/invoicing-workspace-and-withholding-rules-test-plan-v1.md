# invoicing-workspace-and-withholding-rules-test-plan-v1

Feature ID: `ANCLORA-INV-001`

## Scope

- API de facturacion (`GET/POST /api/invoices`).
- Formulario y calculo de total.
- Listado de facturas por usuario.

## Casos funcionales

1. Abrir `/dashboard/facturacion` con sesion valida.
2. Crear factura con cliente, NIF, base, IVA, IRPF y fecha.
3. Ver confirmacion y factura en listado.
4. Ver que `total_amount` coincide con formula.
5. Ver estado inicial `draft`.

## Casos de borde

1. Payload invalido -> `400`.
2. Sesion invalida -> `401`.
3. Sin facturas -> estado vacio.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Feature operativa sin P0/P1 y gate final en GO.

