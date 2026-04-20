# Anclora Ecosystem Contract Groups

## Objetivo
Definir el marco contractual UX/UI del ecosistema Anclora y fijar una ruta única de consulta para cualquier modificación visual o creación de una nueva aplicación.

Ruta canónica:
- `docs/standards/`

Regla de publicación:
- La bóveda debe mantener una copia maestra de estos contratos en `docs/standards/`.
- Cada aplicación debe incluir en su propio `docs/standards/` los contratos que le apliquen.
- Si un contrato se modifica a nivel ecosistema, la bóveda y las aplicaciones afectadas deben actualizarse en la misma ronda.

## Modelo de autoridad

- La bóveda gobierna:
  - clasificación del ecosistema
  - contratos
  - alcance
  - excepciones
  - criterios de cumplimiento
- `anclora-design-system` gobierna la implementación ejecutable de:
  - `taxonomy`
  - `tokens`
  - `themes`
  - `foundations`
  - `components`
  - `patterns`
  - `assets`
- Una app no debe inventar una tercera fuente de verdad local para botones, cards, modales, shell, tipografía o tokens si ya existe una pieza canónica en `anclora-design-system`.

## Capas reales del design system

Las decisiones visuales y de composición deben apoyarse en estas capas reales del repo `anclora-design-system`:

- `taxonomy`: clasificación de producto y vocabulario de variantes
- `tokens`: tokens primitivos y semánticos
- `themes`: combinaciones de tema por familia y producto
- `foundations`: color, tipografía, spacing, radius, elevation, iconografía y reglas base
- `components`: primitivas y componentes canónicos reutilizables
- `patterns`: shells, bloques, funnels, overlays y composiciones recurrentes
- `assets`: logos, favicons y recursos de marca

Regla práctica:
- si el cambio afecta implementación visual, primero se busca la pieza en `anclora-design-system`
- si el cambio afecta alcance, clasificación o excepciones, primero se consulta la bóveda

## Alcance de esta fase

Aplicaciones internas:
- `anclora-advisor-ai`
- `anclora-nexus`
- `anclora-content-generator-ai`

Aplicaciones premium:
- `anclora-impulso`
- `anclora-command-center`
- `anclora-synergi`
- `anclora-data-lab`
- `anclora-talent`

Aplicaciones ultra premium:
- `anclora-private-estates`
- `anclora-private-estates-landing` (landing pública — dark-only, ES/EN/DE)

Fuera de alcance en esta fase:
- ninguno

## Fuentes auditadas

Contratos documentados detectados:
- `docs/standards/UI_MOTION_CONTRACT.md` en `anclora-impulso`
- `docs/standards/MODAL_CONTRACT.md` en `anclora-impulso`
- `docs/standards/LOCALIZATION_CONTRACT.md` en `anclora-impulso`
- `sdd/contracts/UI-SURFACE-INTERACTION-CONTRACT.md` en `anclora-nexus`
- `sdd/contracts/UI-PAGE-PRIMITIVES-CONTRACT.md` en `anclora-nexus`
- `sdd/contracts/UI-EXTERNAL-PORTAL-PREMIUM-CONTRACT.md` en `anclora-nexus`
- contratos de campos `text/select/boolean` en `anclora-nexus`

Contratos implícitos pero claros en código y UX:
- estructura de preferencias `locale + theme` en `anclora-advisor-ai`
- patrón `locale + theme toggles` en `anclora-data-lab`
- patrón premium editorial en `anclora-synergi`
- patrón ultra premium oro/teal en `anclora-private-estates`
- patrón de botones/cards/modales de `anclora-impulso` para producto premium de `fitness_wellness`
- patrón dark-only + switcher de idioma en `anclora-private-estates-landing` (emergente, 2026-04-05)

## Contratos canónicos del ecosistema

Base transversal:
- `UI_MOTION_CONTRACT.md`
- `MODAL_CONTRACT.md`
- `LOCALIZATION_CONTRACT.md`

Por grupo:
- `ANCLORA_INTERNAL_APP_CONTRACT.md`
- `ANCLORA_PREMIUM_APP_CONTRACT.md`
- `ANCLORA_ULTRA_PREMIUM_APP_CONTRACT.md`
- `ANCLORA_PORTFOLIO_SHOWCASE_CONTRACT.md`

Branding transversal:
- `ANCLORA_BRANDING_MASTER_CONTRACT.md`
- `ANCLORA_BRANDING_ICON_SYSTEM.md`
- `ANCLORA_BRANDING_COLOR_TOKENS.md`
- `ANCLORA_BRANDING_TYPOGRAPHY.md`
- `ANCLORA_BRANDING_FAVICON_SPEC.md`

Mapeo obligatorio hacia `anclora-design-system`:
- contratos de branding -> `assets`, `tokens`, `themes`, `foundations`
- contratos de grupo -> `taxonomy`, `themes`, `components`, `patterns`
- motion -> `tokens`, `foundations`, `components`
- modales -> `components`, `patterns`
- localización -> `patterns`, `components`, `foundations`

Documentos de apoyo no normativos:
- `ANCLORA_INTERNAL_APPS_GAP_ANALYSIS.md`

## Orden de lectura obligatorio

Al tocar botones, cards, shells, tablas o bloques interactivos:
1. pieza equivalente en `anclora-design-system` (`components` o `patterns`)
2. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
3. contrato del grupo aplicable
4. `UI_MOTION_CONTRACT.md`
5. `LOCALIZATION_CONTRACT.md`

Al tocar tema, tokens o variantes visuales de botones:
1. capa equivalente en `anclora-design-system` (`tokens`, `themes`, `foundations`)
2. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
3. contrato del grupo aplicable
4. `CONTRACT_CONDITION_CATALOG.md`
5. `UI_MOTION_CONTRACT.md`

Al tocar modales:
1. primitive o pattern equivalente en `anclora-design-system`
2. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
3. contrato del grupo aplicable
4. `MODAL_CONTRACT.md`
5. `LOCALIZATION_CONTRACT.md`

Al crear una app nueva:
1. clasificarla como `interna`, `premium` o `ultra premium`
2. clasificar además `domain`, `product_archetype`, `system_role` y `ecosystem_clusters`
3. copiar a `docs/standards/` el set base y el contrato de grupo
4. partir de `anclora-design-system` para `tokens`, `themes`, `components` y `patterns`
5. leer la capa de branding correspondiente
6. documentar cualquier excepción local antes de implementar componentes nuevos

## Mapa de asignación por aplicación

| Aplicación | Grupo | Idiomas objetivo | Tema objetivo | Contratos mínimos |
| --- | --- | --- | --- | --- |
| `anclora-advisor-ai` | Interna | `es`, `en` | `dark/light/system` | Base + interno |
| `anclora-nexus` | Interna | `es`, `en`, `de`, `ru` | `dark` operativo | Base + interno |
| `anclora-content-generator-ai` | Interna | `es`, `en` | `dark/light/system` | Base + interno |
| `anclora-impulso` | Premium | `es`, `en` | `dark/light` | Base + premium |
| `anclora-command-center` | Premium | `es`, `en`, `de` | `dark/light` | Base + premium |
| `anclora-synergi` | Premium | `es`, `en`, `de` | tema editorial único | Base + premium |
| `anclora-data-lab` | Premium | `es`, `en`, `de` | `dark/light/system` | Base + premium |
| `anclora-talent` | Premium | `es`, `en` | `dark/light` | Base + premium |
| `anclora-private-estates` | Ultra premium | `es`, `en`, `de`, `fr` | premium multi-theme | Base + ultra premium |
| `anclora-private-estates-landing` | Ultra premium (landing pública) | `es`, `en`, `de` ¹ | `dark-only` ² | Base + ultra premium |
| `anclora-portfolio` | Portfolio / showcase | `es`, `en` | tema editorial único o dual diseñado | Base + portfolio |
| `anclora-azure-bay-landing` | Portfolio / showcase | `es`, `en` | tema editorial único | Base + portfolio |
| `anclora-playa-viva-uniestate` | Portfolio / showcase | `es`, `en` | tema editorial único | Base + portfolio |

Entidad transversal fuera de familias de app:
- `anclora-group` se trata como entidad matriz y portal corporativo, con branding propio definido en `ANCLORA_BRANDING_*`, no como app interna del grupo.

Regla complementaria:
- `anclora-group` mantiene contratos universales, pero su branding se gobierna como caso único en la capa `ANCLORA_BRANDING_*`.

Excepciones documentadas activas:

¹ `anclora-private-estates-landing` cubre `es/en/de`. El idioma `fr` está aplazado a una iteración futura. Esta excepción es válida porque el copy en francés no está validado al nivel de calidad exigido por el contrato ultra premium. La cobertura de `fr` se activa cuando el copy esté revisado editorialmente.

² `anclora-private-estates-landing` opera exclusivamente en modo oscuro (`dark-only`). El toggle de tema fue eliminado deliberadamente y reemplazado por un selector de idioma `ES / EN / DE`. Esta decisión es una excepción documentada al contrato `ANCLORA_ULTRA_PREMIUM_APP_CONTRACT`, que permite multi-theme. La excepción es válida porque la landing es una superficie de captación editorial y no una aplicación operativa que el usuario usa en distintos entornos. El modo único refuerza la firma visual, simplifica el mantenimiento y reduce el riesgo de degradación visual entre modos.

## Política de excepciones

- Una excepción local no puede contradecir la semántica base de botones, cards, modales, tema o localización.
- Una excepción visual sólo es válida si responde a:
  - una necesidad de marca explícita
  - una necesidad legal o de accesibilidad
  - una necesidad operativa de dominio
- Toda excepción debe documentarse en el `docs/standards/` del repo afectado.

## Criterio de cumplimiento

Una app no cumple el contrato si:
- tiene soporte técnico de idiomas o tema pero no experiencia visible coherente
- mezcla semánticas distintas para acciones equivalentes
- introduce modales con scroll evitable
- crea nuevas superficies fuera de la gramática del grupo
- reintroduce hardcoded strings donde el contrato exige i18n
- cambia el foreground o el contraste de una familia de botón entre temas sin mantener semántica estable o sin documentar una variante real por tema
