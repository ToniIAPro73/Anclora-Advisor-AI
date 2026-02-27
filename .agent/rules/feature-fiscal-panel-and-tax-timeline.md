---
trigger: always_on
---

# Feature Rule - Fiscal Panel and Tax Timeline

Feature ID: `ANCLORA-FISC-001`

## Alcance v1

- Implementar `/dashboard/fiscal` con datos reales de `fiscal_alerts`.
- Mostrar widget de Cuota Cero con estado operacional.
- Mostrar timeline de vencimientos IVA/IRPF por `due_date`.
- Mantener RLS por usuario autenticado.

## Restricciones

- No romper flujo auth/middleware existente.
- No exponer datos de otros usuarios.
- No exponer secretos en cliente.

## Definition of Done

- Spec/test-plan cerrados.
- Panel fiscal conectado a Supabase.
- QA report y gate final emitidos.
- Checks en verde.

