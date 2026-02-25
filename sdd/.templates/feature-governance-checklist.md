# Feature Governance Checklist Template

## Identidad
- Feature:
- ID:
- Responsable:
- Fecha:

## Pre-implementacion
- [ ] Spec v1 creada o actualizada.
- [ ] Alcance y no-alcance definidos.
- [ ] Riesgos tecnicos definidos.
- [ ] Test plan v1 creado o actualizado.

## Implementacion
- [ ] Cambios acotados al alcance.
- [ ] Sin secretos en cliente.
- [ ] Tipado estricto mantenido.

## Validacion
- [ ] `npm run -s lint`
- [ ] `npm run -s type-check`
- [ ] `npm run -s build`
- [ ] Pruebas funcionales de `/api/chat`.

## Cierre
- [ ] QA report actualizado.
- [ ] Gate final emitido (GO/NO-GO).
- [ ] Docs actualizadas si aplica.
