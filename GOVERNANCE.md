# Governance

Normas base para decisiones y cambios en el repositorio.

## Principios
1. Fiabilidad funcional primero.
2. Seguridad y privacidad por defecto.
3. Cambios trazables en SDD.
4. Sin ruptura silenciosa de contrato API.

## Cambios de core
Si una feature modifica reglas base, versionar en `sdd/core` y registrar en `sdd/core/CHANGELOG.md`.

## Validaciones minimas
- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Evidencia requerida
- QA report y gate final en la feature correspondiente.
