# fiscal-panel-and-tax-timeline-spec-v1

Feature ID: `ANCLORA-FISC-001`

## 1. Problema

El dashboard no tenia panel fiscal operativo con datos reales por usuario.

## 2. Objetivo

Entregar una vista fiscal funcional con Cuota Cero y timeline de impuestos usando `fiscal_alerts`.

## 3. Alcance

- Consulta real de `fiscal_alerts` bajo RLS.
- Widget de estado/progreso para Cuota Cero.
- Timeline de vencimientos para IVA/IRPF.
- Estados vacio/error y resumen de alertas.

## 4. No alcance

- Alta/edicion de alertas desde UI.
- Simulaciones fiscales avanzadas.
- Integracion contable externa.

## 5. Requisitos funcionales

- RF1: Cargar alertas fiscales del usuario autenticado.
- RF2: Mostrar estado de Cuota Cero.
- RF3: Mostrar timeline ordenado por `due_date` para modelos 303/130.
- RF4: Mostrar prioridad y estado por alerta.
- RF5: Mostrar estado vacio y error cuando aplique.

## 6. Requisitos no funcionales

- RNF1: Preservar RLS (solo datos del usuario).
- RNF2: No exponer secretos ni errores internos en cliente.
- RNF3: Render estable en desktop/mobile.

## 7. Riesgos

- Falta de datos en tabla para algunos usuarios.
- Divergencia entre semantica de Cuota Cero y datos disponibles.

## 8. Criterios de aceptacion

- CA1: Panel fiscal renderiza datos reales de `fiscal_alerts`.
- CA2: Cuota Cero y timeline visibles en UI.
- CA3: Checks tecnicos en verde.

## 9. Plan de pruebas

Ver `fiscal-panel-and-tax-timeline-test-plan-v1.md`.

## 10. Plan de rollout

1. Deploy frontend.
2. Smoke test de `/dashboard/fiscal` con usuario autenticado.
3. Continuar con `ANCLORA-LAB-001`.

