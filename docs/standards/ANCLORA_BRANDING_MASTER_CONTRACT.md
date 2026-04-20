---
title: ANCLORA_BRANDING_MASTER_CONTRACT
type: standard
estado: activo
scope: branding
tags: [branding, standards, anclora, contract]
related:
  - "[[ANCLORA_BRANDING_ICON_SYSTEM]]"
  - "[[ANCLORA_BRANDING_COLOR_TOKENS]]"
  - "[[ANCLORA_BRANDING_TYPOGRAPHY]]"
  - "[[ANCLORA_BRANDING_FAVICON_SPEC]]"
  - "[[ANCLORA_ECOSYSTEM_CONTRACT_GROUPS]]"
---

# ANCLORA_BRANDING_MASTER_CONTRACT

## Objetivo

Definir el sistema de identidad visual completo del ecosistema Anclora: logos, paletas de color, tipografía, iconografía y reglas de uso. Este contrato es la referencia única para cualquier decisión de branding en cualquier aplicación del ecosistema.

## Autoridad

- Registro operativo: `docs/governance/contracts-registry.json`
- Inventario aplicable: `docs/governance/ecosystem-repos.json`
- Fuente ejecutable relacionada: `anclora-design-system`

## Ruta canónica

- Obsidian: Bóveda maestra (copia de referencia)
- Repos: `docs/standards/ANCLORA_BRANDING_MASTER_CONTRACT.md`

## Regla de publicación

- La bóveda Obsidian mantiene la copia maestra.
- Cada aplicación debe referenciar este contrato en su propio `docs/standards/`.
- Si se modifica un token de branding a nivel ecosistema, todas las aplicaciones afectadas deben actualizarse en la misma ronda.

## Repos a los que aplica

- `anclora-group`
- `anclora-advisor-ai`
- `anclora-nexus`
- `anclora-content-generator-ai`
- `anclora-impulso`
- `anclora-command-center`
- `anclora-synergi`
- `anclora-data-lab`
- `anclora-talent`
- `anclora-private-estates`

Nota:
- `anclora-group` actúa como referencia matriz de branding y puede recibir contratos de branding o gobernanza cuando el registro central lo indique.
- Las superficies `portfolio` se gobiernan con `ANCLORA_PORTFOLIO_SHOWCASE_CONTRACT.md`, no con este contrato maestro de branding.

## Sincronización con repos consumidores

- Contrato fuente en la bóveda: `docs/standards/ANCLORA_BRANDING_MASTER_CONTRACT.md`
- Target normal de propagación: `docs/standards/`
- Dependencia de auditoría y propagación desde `docs/governance/contracts-registry.json`

## Documentos del sistema de branding

| Documento | Alcance | Wikilink |
|-----------|---------|----------|
| Master Contract | Índice, clasificación, reglas globales | Este documento |
| Icon System | Estructura, colores y prompts de cada icono | [[ANCLORA_BRANDING_ICON_SYSTEM]] |
| Color Tokens | Tokens CSS dark/light para las 11 apps | [[ANCLORA_BRANDING_COLOR_TOKENS]] |
| Typography | Stacks tipográficos por grupo, detalle por app | [[ANCLORA_BRANDING_TYPOGRAPHY]] |
| Favicon Spec | Paquete favicon, implementación por framework | [[ANCLORA_BRANDING_FAVICON_SPEC]] |

## Orden de lectura obligatorio

Al crear una app nueva:
1. [[ANCLORA_ECOSYSTEM_CONTRACT_GROUPS]] — clasificar la app
2. Este documento — reglas globales
3. [[ANCLORA_BRANDING_ICON_SYSTEM]] — asignar color de ondas y borde
4. [[ANCLORA_BRANDING_COLOR_TOKENS]] — copiar tokens base del grupo + definir accent
5. [[ANCLORA_BRANDING_TYPOGRAPHY]] — copiar stack tipográfico del grupo
6. [[ANCLORA_BRANDING_FAVICON_SPEC]] — generar favicon package
7. Registrar la nueva app en los contratos de branding que correspondan

Al modificar la identidad de una app existente:
1. Este documento
2. El contrato de branding específico que aplique
3. Documentar la excepción si la hay

## Clasificación de aplicaciones

| Categoría | Apps | Borde de icono | Tipografía | Descripción |
|-----------|------|---------------|-----------|-------------|
| Entidad Matriz | `anclora-group` | Plata monocromática | Georgia, serif | Portal corporativo y entidad matriz del ecosistema. Identidad exclusiva fuera de grupos. |
| Interna | `anclora-advisor-ai`, `anclora-nexus`, `anclora-content-generator-ai` | Plata cromada | Inter | Herramientas operativas internas. |
| Premium | `anclora-impulso`, `anclora-talent`, `anclora-data-lab`, `anclora-synergi`, `anclora-command-center` | Cobre rosado | DM Sans | Productos de valor añadido. |
| Ultra Premium | `anclora-private-estates` | Oro pulido | Cardo + Inter + Fraunces | Marca de lujo inmobiliario. |
| Portfolio | `anclora-portfolio`, `anclora-azure-bay-landing`, `anclora-playa-viva-uniestate` | Por proyecto | Por proyecto | Fuera de alcance de este contrato. |

## Regla de escalera visual

```
PLATA MONO (Entidad Matriz) → PLATA + color (internas) → COBRE (premium) → ORO (ultra premium)
```

- **Borde** comunica la categoría
- **Ondas** comunican la app
- **Interior** refuerza la personalidad cromática
- Ondas = borde (monocromático) → Entidad Matriz o Private Estates
- Ondas ≠ borde → app de un grupo operativo

## Mapa de colores de acento por app

| App | Accent | Hue | Borde |
|-----|--------|-----|-------|
| `anclora-group` | `#A8AEB8` plata | 220° | Plata (mono) |
| `anclora-advisor-ai` | `#1DAB89` teal | 162° | Plata |
| `anclora-nexus` | `#D4AF37` oro | 45° | Plata |
| `anclora-content-generator-ai` | `#E06848` coral | 12° | Plata |
| `anclora-impulso` | `#FF6A00` naranja | 25° | Cobre |
| `anclora-data-lab` | `#2DA078` esmeralda | 155° | Cobre |
| `anclora-talent` | `#4A9FD8` azul cielo | 205° | Cobre |
| `anclora-synergi` | `#8C5AB4` púrpura | 280° | Cobre |
| `anclora-command-center` | `#CC4455` rojo granate | 355° | Cobre |
| `anclora-private-estates` | `#D4AF37` oro | 45° | Oro (mono) |

## Invariantes globales de branding

1. **Símbolo fundacional**: Círculo + tres ondas horizontales. Todas las apps del ecosistema (excepto portfolio) usan este símbolo.
2. **Proporciones**: Todas las variantes mantienen exactamente las mismas proporciones, diámetro, separación entre ondas y forma.
3. **Fondo transparente**: Todo icono se entrega en PNG con canal alfa.
4. **Tamaño canónico**: 1024×1024 px.
5. **No se permite texto dentro del icono**.
6. **Zona de exclusión mínima**: 0.25× diámetro del emblema en todas las direcciones.
7. **Separación mínima de hue entre ondas** dentro del mismo grupo: 30°.

## Criterio de cumplimiento

Una app no cumple el contrato de branding si:
- Usa colores de acento que no coinciden con los tokens definidos en [[ANCLORA_BRANDING_COLOR_TOKENS]]
- Usa un borde de icono que no corresponde a su grupo
- Modifica las proporciones del icono fundacional
- Introduce tipografía no declarada en [[ANCLORA_BRANDING_TYPOGRAPHY]]
- No incluye el favicon package completo según [[ANCLORA_BRANDING_FAVICON_SPEC]]
- Usa una fuente reservada para otra categoría
