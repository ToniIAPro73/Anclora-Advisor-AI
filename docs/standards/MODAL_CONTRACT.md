# Modal Contract

## Objetivo
Garantizar un patrón único de modales en todo el ecosistema Anclora: jerarquía clara, acciones visibles y cero scroll evitable.

## Reglas obligatorias
- El modal se dimensiona según contenido y viewport real, no desde un ancho fijo heredado por defecto.
- La primera estrategia es reorganizar layout y ampliar superficie útil, no introducir scroll.
- El modal puede ocupar gran parte del viewport si eso mejora edición o lectura.
- El cierre debe ser visible arriba a la derecha.
- Las acciones finales deben ser visibles y previsibles en la parte inferior.
- El fondo del modal debe separar con claridad la superficie modal del fondo.

## Regla de scroll
- El scroll de modal completo es el último recurso.
- Antes de aceptarlo hay que:
  - ampliar tamaño
  - redistribuir columnas
  - compactar spacing sobrante
  - agrupar campos breves
  - segmentar contenido en tabs, steps o bloques
- Si un bloque concreto es el que crece demasiado, el scroll debe vivir en ese bloque antes que en todo el modal.

## Layout recomendado
- Header alineado a la izquierda con espacio para cierre superior derecho.
- Body en `grid` o layout explícito, nunca como columna larga por inercia.
- Footer con secundaria y primaria claramente diferenciadas.
- En desktop: secundaria a la izquierda o neutralizada; primaria a la derecha.

## Modales densos
- Formularios complejos: usar modal ancho o casi fullscreen.
- Bibliotecas de resultados: limitar ventana visible y añadir paginación o navegación.
- Selectores visuales: evitar hover que invada el espacio de cards contiguas.
- No introducir scroll horizontal salvo casos técnicos extremos.

## Adaptación por grupo

Aplicaciones internas:
- priorizar velocidad de lectura y edición
- framing sobrio
- foco en densidad útil

Aplicaciones premium:
- se permite un tratamiento más editorial del backdrop y del header
- no se sacrifica claridad operativa

Aplicaciones ultra premium:
- se permite un framing más ceremonial
- si la interacción supera el límite cómodo de un modal, debe escalar a sheet o página dedicada

## Gate de aceptación

Un modal no está listo si:
- obliga a scroll vertical por mala composición
- esconde acciones críticas
- no deja claro cómo cerrarlo
- comprime cards, tablas o formularios hasta volverlos frágiles
