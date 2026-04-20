# Localization Contract

## Objetivo
Garantizar que cada aplicación del ecosistema respete su cobertura real de idiomas y que ninguna feature nueva introduzca mezcla de idioma, deuda de traducción o layouts rotos por expansión de copy.

## Fuente ejecutable

La localización visible debe apoyarse en piezas reales de `anclora-design-system` cuando existan:
- `components` para selector o toggle de idioma
- `patterns` para preferencias visibles de `locale + theme`
- `foundations` para spacing, wrap y legibilidad en labels, CTAs, tabs y headings

Regla:
- el contrato fija cobertura y cumplimiento; el design system fija cómo se ve y se comporta la capa de selección e i18n visible.

## Autoridad

- Registro operativo: `docs/governance/contracts-registry.json`
- Inventario aplicable: `docs/governance/ecosystem-repos.json`
- Fuente ejecutable relacionada: `anclora-design-system`

## Regla base
- El contrato de localización se adapta al número de idiomas objetivo de cada app, no a la cantidad de locales que pueda haber en helpers internos.

Cobertura objetivo por aplicación:
- `anclora-advisor-ai`: `es`, `en`
- `anclora-nexus`: `es`, `en`, `de`, `ru`
- `anclora-content-generator-ai`: `es`, `en`
- `anclora-impulso`: `es`, `en`
- `anclora-command-center`: `es`, `en`, `de`
- `anclora-synergi`: `es`, `en`, `de`
- `anclora-data-lab`: `es`, `en`, `de`
- `anclora-talent`: `es`, `en`
- `anclora-private-estates`: `es`, `en`, `de`, `fr`
- landing pública de `anclora-private-estates`: `es`, `en`, `de` (excepción: `fr` aplazado; ver nota en `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`)

## Repos a los que aplica

- `anclora-advisor-ai`
- `anclora-nexus`
- `anclora-content-generator-ai`
- `anclora-impulso`
- `anclora-command-center`
- `anclora-synergi`
- `anclora-data-lab`
- `anclora-talent`
- `anclora-private-estates`
- `anclora-portfolio`
- `anclora-azure-bay-landing`
- `anclora-playa-viva-uniestate`

Nota:
- `anclora-group` mantiene la autoridad matriz de marca y gobernanza, pero no es target normal de propagación de este contrato transversal.

## Sincronización con repos consumidores

- Contrato fuente en la bóveda: `docs/standards/LOCALIZATION_CONTRACT.md`
- Target normal de propagación: `docs/standards/`
- Dependencia de auditoría y propagación desde `docs/governance/contracts-registry.json`

## Reglas obligatorias
- No mezclar idiomas en una misma vista salvo contenido de terceros o nombres propios.
- Todo texto visible de producto debe nacer en la capa de traducción aprobada por el repo.
- No cerrar una feature con copy sólo en el idioma por defecto.
- El idioma visible al usuario debe poder trazarse a:
  - selector visible
  - preferencia persistida
  - o fallback explícito documentado
- Las pantallas deben soportar expansión de copy sin desbordes, truncados peligrosos ni CTAs rotos.

## Reglas de implementación
- No hardcodear labels, placeholders, estados, validaciones ni títulos de modal si la app soporta más de un idioma.
- Las claves deben agruparse por dominio y no crecer como lista plana sin criterio.
- El fallback de una clave ausente no puede quedar silenciosamente en otro idioma sin detectarse en QA.
- Todo selector de idioma debe actualizar:
  - `lang`
  - estado visual del toggle
  - persistencia local o equivalente

## Reglas de layout
- No resolver diferencias de longitud con truncado agresivo como solución principal.
- Permitir wraps controlados en:
  - tabs
  - botones secundarios largos
  - headings
  - labels de filtros
- Si un idioma rompe la composición, se corrige la composición, no se sacrifica la traducción.

## Excepciones permitidas
- marca
- nombres propios
- términos legales o de terceros cuando no tenga sentido traducirlos
- datos del usuario o payloads externos

## Gate de aceptación

Una feature no está lista si:
- deja textos nuevos fuera de i18n
- la vista mezcla idiomas
- el selector de idioma existe pero no gobierna toda la superficie afectada
- una traducción rompe layout y se ignora como “caso raro”
