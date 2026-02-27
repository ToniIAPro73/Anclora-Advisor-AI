# i18n-observability-and-release-hardening-spec-v1

Feature ID: `ANCLORA-HARD-001`

## 1. Problema

El producto necesita un cierre transversal de release con trazabilidad basica en APIs, validacion de i18n y smoke tests de rutas criticas.

## 2. Objetivo

Reducir riesgo operativo de release mediante:

- logs estructurados con `request_id`,
- mensajes backend bilingues (`es/en`) con validacion de paridad,
- smoke test automatizado de rutas y handlers principales.

## 3. Alcance

- `/api/chat` y `/api/invoices` con logging estructurado y `x-request-id`.
- Diccionario i18n server-side y helper de traduccion.
- Test `test:i18n` y `test:smoke`.

## 4. No alcance

- Internacionalizacion completa de toda la UI.
- Pipeline externo de observabilidad (Datadog, ELK, etc.).

## 5. Criterios de aceptacion

- CA1: Logs JSON con `request_id` en APIs objetivo.
- CA2: Claves i18n `es/en` en paridad.
- CA3: Smoke test rutas/handlers en PASS.
- CA4: `lint`, `type-check`, `build` en PASS.

