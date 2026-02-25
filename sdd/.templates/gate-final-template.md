# Gate Final Template

Feature:
Feature ID:
Decision: GO | NO-GO
Estado de cierre: CLOSED | BLOCKED | PENDING

## Preconditions
- QA completado:
- `ENV_MISMATCH` = none:
- `I18N_MISSING_KEYS` = none:

## Gates obligatorios
1. Contrato DB/API respetado.
2. Sin bloqueantes P0/P1.
3. Checks tecnicos en verde.
4. SDD/changelog actualizados.

## Resultado
- Si NO-GO: fixes priorizados.
- Si GO: plan de despliegue y rollback.
