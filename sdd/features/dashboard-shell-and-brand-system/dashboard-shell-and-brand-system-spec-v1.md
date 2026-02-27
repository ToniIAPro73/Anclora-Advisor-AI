# dashboard-shell-and-brand-system-spec-v1

Feature ID: `ANCLORA-DSH-001`

## 1. Problema

La aplicacion tenia una estructura funcional minima, sin un shell consistente de dashboard alineado a marca.

## 2. Objetivo

Construir una base visual y de navegacion premium para todo `/dashboard/*` con identidad Anclora Advisor.

## 3. Alcance

- Definicion de tokens visuales globales (color, tipografia, superficies).
- Sidebar con logo, enlaces de seccion y accion de cierre de sesion.
- Topbar contextual segun ruta activa.
- Vistas base de chat/fiscal/laboral/facturacion bajo layout unificado.

## 4. No alcance

- Integracion funcional completa de chat con citas y alertas.
- Widget fiscal real y monitor laboral con datos reales.
- Modulo de facturacion operativo.

## 5. Requisitos funcionales

- RF1: Sidebar visible en desktop y usable en mobile.
- RF2: Topbar muestra seccion activa y correo de sesion.
- RF3: Navegacion entre rutas del dashboard sin ruptura visual.
- RF4: Integracion del logo oficial en shell.

## 6. Requisitos no funcionales

- RNF1: Contraste suficiente en enlaces/controles.
- RNF2: Layout responsive en anchos comunes mobile y desktop.
- RNF3: Sin degradar proteccion de rutas ni flujo auth.

## 7. Riesgos

- Deuda visual por no fijar tokens reutilizables.
- Inconsistencias responsive por comportamiento mixed mobile/desktop.
- Sobrecarga de estilos si no se centraliza en `globals.css`.

## 8. Criterios de aceptacion

- CA1: Shell final aplicado en `/dashboard/*`.
- CA2: Paleta y logo integrados coherentemente.
- CA3: Navegacion principal operativa y clara.
- CA4: `lint`, `type-check`, `build` en verde.

## 9. Plan de pruebas

Ver `dashboard-shell-and-brand-system-test-plan-v1.md`.

## 10. Plan de rollout

1. Deploy de frontend con smoke test de rutas protegidas.
2. Revalidar visual en desktop/mobile.
3. Continuar con `ANCLORA-CHAT-002` sobre shell estabilizado.

