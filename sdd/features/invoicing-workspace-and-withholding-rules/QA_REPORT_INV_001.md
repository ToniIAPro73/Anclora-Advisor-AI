# QA Report - INV_001

Feature: `invoicing-workspace-and-withholding-rules`  
Feature ID: `ANCLORA-INV-001`  
Estado: PASS

## Entorno

- `.env.local` validado: si
- `.env.example` validado: si
- `ENV_MISMATCH`: none

## Scope verificado

- `/dashboard/facturacion` operativo.
- API `GET/POST /api/invoices` con validacion de payload.
- Persistencia en `invoices` bajo usuario autenticado.
- Calculo de total (IVA/IRPF) y previsualizacion en UI.
- Historial de facturas recientes visible.

## Evidencias tecnicas

- `npm run -s lint`: PASS
- `npm run -s type-check`: PASS
- `npm run -s build`: PASS

## Hallazgos

- P0: none
- P1: none
- P2: none

## Riesgos residuales

- Validacion de formato NIF se mantiene generica en v1 (longitud/required); puede endurecerse con regla fiscal especifica en futuras iteraciones.

