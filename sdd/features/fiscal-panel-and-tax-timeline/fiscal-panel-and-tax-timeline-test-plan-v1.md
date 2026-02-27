# fiscal-panel-and-tax-timeline-test-plan-v1

Feature ID: `ANCLORA-FISC-001`

## Scope

- Consulta RLS de `fiscal_alerts`.
- Render de widget Cuota Cero.
- Render de timeline IVA/IRPF.

## Casos funcionales

1. Abrir `/dashboard/fiscal` con sesion valida.
2. Ver resumen de alertas cargadas.
3. Ver estado Cuota Cero y barra de progreso.
4. Ver timeline de alertas `iva`/`irpf` ordenadas por fecha.
5. Ver badges de prioridad y estado.

## Casos de borde

1. Sin alertas -> mensaje de vacio.
2. Error de consulta -> mensaje de error controlado.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Panel fiscal operativo sin P0/P1 y gate en GO.

