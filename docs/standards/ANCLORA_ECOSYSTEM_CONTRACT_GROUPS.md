# Anclora Ecosystem Contract Groups

## Objetivo
Definir el marco contractual UX/UI del ecosistema Anclora y fijar una ruta única de consulta para cualquier modificación visual o creación de una nueva aplicación.

Ruta canónica:
- `docs/standards/`

Regla de publicación:
- La bóveda debe mantener una copia maestra de estos contratos en `docs/standards/`.
- Cada aplicación debe incluir en su propio `docs/standards/` los contratos que le apliquen.
- Si un contrato se modifica a nivel ecosistema, la bóveda y las aplicaciones afectadas deben actualizarse en la misma ronda.

## Alcance de esta fase

Aplicaciones internas:
- `anclora-advisor-ai`
- `anclora-nexus`
- `anclora-content-generator-ai`
- `anclora-impulso` como repositorio fuente de contratos base

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
- patrón de botones/cards/modales de `anclora-impulso` para producto interno denso
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

Documentos de apoyo no normativos:
- `ANCLORA_INTERNAL_APPS_GAP_ANALYSIS.md`

## Orden de lectura obligatorio

Al tocar botones, cards, shells, tablas o bloques interactivos:
1. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
2. contrato del grupo aplicable
3. `UI_MOTION_CONTRACT.md`
4. `LOCALIZATION_CONTRACT.md`

Al tocar tema, tokens o variantes visuales de botones:
1. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
2. contrato del grupo aplicable
3. `CONTRACT_CONDITION_CATALOG.md`
4. `UI_MOTION_CONTRACT.md`

Al tocar modales:
1. `ANCLORA_ECOSYSTEM_CONTRACT_GROUPS.md`
2. contrato del grupo aplicable
3. `MODAL_CONTRACT.md`
4. `LOCALIZATION_CONTRACT.md`

Al crear una app nueva:
1. clasificarla como `interna`, `premium` o `ultra premium`
2. copiar a `docs/standards/` el set base y el contrato de grupo
3. leer la capa de branding correspondiente
4. documentar cualquier excepción local antes de implementar componentes nuevos

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
