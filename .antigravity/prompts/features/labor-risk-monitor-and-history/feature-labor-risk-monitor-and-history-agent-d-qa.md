# Agent D - QA

Validar:

1. `/dashboard/laboral` requiere sesion.
2. Datos cargan desde `labor_risk_assessments` por usuario autenticado.
3. Score, nivel, recomendaciones e historial visibles.
4. Empty/error state renderizado sin romper layout.

Checks tecnicos:

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

Salida:

- `QA_REPORT_LAB_001.md` con hallazgos P0/P1/P2.

