# Anclora Internal App Contract

## Objetivo
Unificar la UX/UI de las aplicaciones internas sin borrar la identidad de cada producto. La lógica de interacción debe sentirse igual; la identidad puede variar en acento, tipografía secundaria y tono editorial.

Ámbito:
- `anclora-group`
- `anclora-advisor-ai`
- `anclora-nexus`
- `anclora-content-generator-ai`
- `anclora-impulso`

## Invariantes de grupo

### 1. Shell
- La pantalla debe seguir la jerarquía `header operativo + navegación persistente + área principal`.
- Las preferencias de usuario deben vivir en el mismo cuadrante del shell: cuenta, idioma, tema y logout.
- El estado activo de navegación debe ser inequívoco.
- No se permite cambiar el patrón de navegación entre vistas equivalentes sin razón funcional documentada.

### 2. Botones
- Familias obligatorias:
  - `primary`
  - `secondary`
  - `ghost`
  - `destructive`
- La acción principal debe ser la más visible de la vista.
- La acción destructiva no puede competir visualmente con la primaria.
- Los botones equivalentes deben compartir:
  - altura
  - radio
  - nivel de contraste
  - transición de hover/focus
  - estado disabled

### 3. Cards y surfaces
- Toda card interactiva debe tener hover y focus consistentes.
- Las cards del mismo bloque deben moverse y elevarse con la misma intensidad.
- KPIs, quick actions y bloques de resumen deben seguir la misma gramática de superficie.
- Ninguna surface puede dejar texto técnico, IDs o labels largos saliéndose del contenedor.

### 4. Modales
- Se aplica `MODAL_CONTRACT.md`.
- Reglas adicionales del grupo:
  - formularios complejos: modal ancho o casi fullscreen antes que columna larga con scroll
  - selectores densos: paginación, tabs o segmentación antes que lista infinita
  - cierre superior derecho siempre visible
  - acciones primarias/secundarias siempre legibles en el footer

### 5. Formularios
- Label visible siempre.
- Placeholder sólo como ayuda.
- Errores y ayudas debajo del campo.
- Inputs, selects y textareas deben compartir altura y radio por familia.
- El autofill del navegador no puede romper dark mode ni contraste.

### 6. Listas, tablas y colas
- Toda lista operativa debe exponer estado, prioridad o contexto y una acción clara.
- Filtros y búsqueda en la parte superior inmediata del bloque.
- La lectura debe separar con claridad información, acción y destrucción.

### 7. Motion
- Se aplica `UI_MOTION_CONTRACT.md`.
- El motion interno debe ser corto, funcional y no teatral.
- No usar animaciones largas, rebotes ni desplazamientos que resten velocidad de lectura.

### 8. Localización
- Se aplica `LOCALIZATION_CONTRACT.md`.
- No se permite mezclar idiomas en una misma vista.
- Los layouts deben absorber expansiones de texto sin truncado agresivo.

### 9. Tema
- Los tokens base deben existir aunque una app publique un solo tema.
- No se permiten colores hardcodeados por pantalla si la semántica ya existe en el sistema UI.
- Los componentes nuevos deben nacer listos para tema real y para un futuro modo alternativo cuando el roadmap lo exija.

## Reglas particulares por aplicación

### `anclora-group`
- Contrato objetivo de producto:
  - `es` y `en`
  - toggle visible de idioma
  - toggle visible de tema `dark/light`
- La experiencia debe dejar de depender de capacidad interna no expuesta al usuario.

### `anclora-advisor-ai`
- Baseline interna para:
  - preferencias persistidas
  - `dark/light/system`
  - bilingüe `es/en`
- Las futuras apps internas deben reutilizar este patrón de preferencias cuando no exista una razón fuerte para desviarse.

### `anclora-nexus`
- Mantener dark como contrato operativo principal.
- Mantener cobertura `es/en/de/ru`.
- Los contratos existentes de `surface` y `page primitives` siguen vigentes y deben leerse como implementación concreta del grupo interno.
- No introducir nuevos portales, cards o modales fuera de la gramática ya definida en `sdd/contracts`.

### `anclora-content-generator-ai`
- Contrato objetivo:
  - `es/en`
  - toggle visible de idioma
  - `dark/light/system`
- El tema ya está maduro; la deuda principal es cerrar i18n visible y completa.

### `anclora-impulso`
- Mantener las decisiones locales de nutrición y salud dentro de la gramática interna.
- El verde puede seguir siendo acento primario de dominio siempre que conserve semántica de acción principal del grupo.

## Gate de aceptación

Una feature interna no está lista si:
- introduce un quinto estilo de botón sin contrato
- rompe la jerarquía de shell o preferencias
- añade un modal denso con scroll evitable
- deja textos visibles fuera de i18n cuando la app requiere localización
- usa un hover o elevación arbitraria que rompa el bloque
