# Agent B - Data

Implementa capa de datos para `/dashboard/laboral`:

1. Leer `labor_risk_assessments` con cliente scopeado por token de usuario.
2. Ordenar por `created_at DESC`.
3. Exponer estado vacio/error controlado para UI.

Checks:

- No usar service role en cliente.
- No romper RLS.

