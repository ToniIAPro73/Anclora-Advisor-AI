# Shared Context - labor-risk-monitor-and-history

Feature ID: `ANCLORA-LAB-001`

## Fuente de verdad

- Tabla: `public.labor_risk_assessments`
- Campos usados:
  - `id`
  - `scenario_description`
  - `risk_score`
  - `risk_level`
  - `recommendations`
  - `created_at`

## Reglas

- Lectura siempre bajo contexto de usuario autenticado.
- No mezclar datos entre usuarios.
- No escribir ni modificar evaluaciones en esta fase (solo lectura).

