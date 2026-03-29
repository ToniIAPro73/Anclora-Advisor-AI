# UI Motion Contract

## Objetivo
Definir la mecánica visual base de botones, cards y frames interactivos del ecosistema Anclora para que todas las apps compartan la misma lógica de respuesta aunque cambie la identidad de marca.

## Superficies soportadas
- `ui-motion-card`
- `ui-motion-button`
- `ui-motion-frame`

## Comportamiento obligatorio
- Elevación en `hover` y `focus-visible`.
- Sombra perceptible, nunca ruidosa.
- Borde o halo visible al activarse la elevación.
- Transiciones rápidas y homogéneas.
- Respeto a `prefers-reduced-motion`.

## Diferenciación por tipo
- `card`: elevación más profunda y lectura de bloque.
- `button`: respuesta corta y táctil.
- `frame`: elevación intermedia para filas, navegación y contenedores secundarios.

## Reglas de incorporación
- Nuevas cards deben usar el componente base del repo o una clase equivalente alineada con este contrato.
- Nuevos botones deben nacer desde el sistema UI del repo, no desde clases arbitrarias por pantalla.
- Nuevos contenedores interactivos que no sean `Card` ni `Button` deben entrar en la familia `frame`.
- No se deben inventar animaciones locales si el patrón encaja en uno de los tres tipos anteriores.

## Reglas de bloque
- Las cards hermanas de un mismo bloque deben compartir la misma intensidad de elevación.
- No se permiten hover espectaculares que provoquen solapes, clipping o sensación de inestabilidad.
- Las métricas y summary cards de dashboards deben tender a una elevación sutil.

## Contrato de campos editables
- En tema oscuro, los campos editables no pueden volverse claros por autofill o estilos nativos.
- Inputs, textareas y equivalentes deben respetar el fondo de la superficie activa.
- Cualquier override local debe preservar contraste, color de texto y coherencia con la familia de campos.

## Adaptación por grupo

Aplicaciones internas:
- motion corto
- lectura rápida
- cero teatralidad

Aplicaciones premium:
- motion más refinado
- profundidad algo mayor
- sin comprometer claridad

Aplicaciones ultra premium:
- motion con más firma visual
- permitido shimmer o barrido ligero
- nunca a costa de precisión o rendimiento percibido

## Referencias relacionadas
- `MODAL_CONTRACT.md`
- contrato de grupo aplicable

## Gate de aceptación

Una superficie no está lista si:
- su hover no coincide con el bloque al que pertenece
- introduce una nueva semántica de movimiento sin contrato
- rompe contraste o focus visible
- genera solapes o desplazamientos innecesarios

## Validación visual obligatoria

- Esta validación aplica a todas las aplicaciones del ecosistema Anclora, sin excepción:
  - internas
  - premium
  - ultra premium
  - portfolio/showcase
- Antes de subir cambios que afecten a cards, botones, frames o cualquier superficie con motion, hay que validarlos visualmente en entorno real al menos en:
  - escritorio
  - móvil
- La validación mínima debe confirmar:
  - que la surface no pierde bordes, sombra ni legibilidad al elevarse
  - que no invade ni pisa superficies hermanas
  - que no provoca clipping dentro de grids, carruseles, modales o contenedores densos
  - que el hover, focus y active mantienen coherencia visual con su bloque
  - que el comportamiento sigue siendo estable en desktop y mobile
- Si una surface funciona bien en escritorio pero rompe layout o jerarquía en móvil, no cumple el contrato.
- Si la verificación visual falla o no puede completarse en ambos viewports obligatorios, el cambio no debe darse por válido ni subirse sin avisarlo explícitamente.
