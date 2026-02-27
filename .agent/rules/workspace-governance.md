---
trigger: always_on
---

# Workspace Governance - Anclora Advisor AI (SDD)

## Jerarquia normativa

1. `.agent/rules/workspace-governance.md`
2. `.agent/rules/anclora-advisor-ai.md`
3. `AGENTS.md`
4. `sdd/core/constitution-canonical.md`
5. `sdd/core/product-spec-v0.md`
6. `sdd/core/spec-core-v1.md`
7. `sdd/features/<feature>/*`
8. `.agent/skills/**/SKILL.md`
9. `.antigravity/prompts/**`

Si hay conflicto, gana el nivel superior.

## Regla core vs feature

- El core no se altera de forma implicita por una feature.
- Si una feature requiere cambiar core, crear nueva version en `sdd/core/` y registrar en `sdd/core/CHANGELOG.md`.

## Flujo SDD obligatorio

1. Definir spec de feature (`*-spec-v1.md`).
2. Definir plan de pruebas (`*-test-plan-v1.md`).
3. Implementar incrementalmente.
4. Ejecutar `npm run -s lint`, `npm run -s type-check`, `npm run -s build`.
5. Validar `/api/chat` con casos de exito y error.
6. Cerrar con `QA_REPORT_*.md` y `GATE_FINAL_*.md`.

## Baseline QA/Gate obligatorio

- Referencia base: `.antigravity/prompts/features/_qa-gate-baseline.md`.
- Referencia de entrega: `.antigravity/prompts/features/_feature-delivery-baseline.md`.
- Cualquier `agent-d-qa` y `gate-final` debe incluir:
  1. Validacion de entorno leyendo `.env.local` y `.env.example`.
  2. Verificacion de coherencia entre variables publicas y servidor.
  3. Prohibido hardcodear secretos o project refs en codigo/prompts.
  4. Validacion i18n de todo texto nuevo en `es` y `en`.
  5. Validacion de migraciones aplicadas cuando la feature toca Supabase.
  6. Limpieza de artefactos temporales de debug/testing.
- Si falla cualquier punto, el gate es NO-GO.

## QA/Gate minimo

- Sin errores P0 en chat UI o navegacion.
- Sin regresion de accesibilidad basica en controles del chat.
- Sin regresion en contrato de `/api/chat`.
- Sin secretos ni datos sensibles en cliente o logs.

## Politica Supabase (inmutable)

### Mapa canonico de proyectos (obligatorio)

- Anclora Advisor AI (este repo):
  - `project_ref`: `lvpplnqbyvscpuljnzqf`
- Anclora Nexus (repo distinto):
  - `project_ref`: `jtlnmypcrgmzxeuiffup`

Regla:
- Este workspace no puede operar contra `jtlnmypcrgmzxeuiffup`.
- Cualquier referencia a un `project_ref` distinto de `lvpplnqbyvscpuljnzqf` en `.env.local`, scripts, prompts o reportes activos implica `ENV_MISMATCH` y `Decision=NO-GO`.

1. Proyecto unico por entorno activo:
   - `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL` deben apuntar al mismo `project_ref`.
2. Coherencia de claves:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` deben pertenecer al mismo `project_ref` de las URLs activas.
3. Prohibido mezclar referencias:
   - Si se detectan dos `project_ref` distintos en `.env.local`, runtime, scripts o prompts, el estado es `ENV_MISMATCH` y el gate es `NO-GO`.
4. Prohibido modificar `.env.local` automaticamente desde agentes:
   - Los agentes pueden leer y validar; cualquier cambio de credenciales lo realiza el operador humano.
5. Preflight obligatorio para features con Supabase:
   - Antes de implementar, ejecutar validacion de entorno y registrar evidencia en QA.

## Politica NotebookLM por dominio (inmutable)

Objetivo: cualquier fuente anadida por MCP debe respetar la finalidad estrategica del cuaderno.

### Cuaderno 1 (Fiscal)

- ID canonical: `ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL`
- Finalidad: escudo juridico-financiero del proyecto.
- Scope permitido:
  - autonomo en Espana
  - foco Baleares
  - IAE, IVA, IRPF, RETA/cuotas, deducciones, cumplimiento e inspeccion
  - escenarios de facturacion y cash-flow fiscal
- Scope prohibido:
  - branding/posicionamiento comercial
  - narrativa de marca no fiscal
  - contenido laboral sin impacto fiscal directo

### Cuaderno 2 (Laboral)

- ID canonical: `ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL`
- Finalidad: airbag estrategico de transicion empleo -> autonomo.
- Scope permitido:
  - pluriactividad y compatibilidades
  - buena fe contractual, despido, conflicto laboral
  - timing de salida y mitigacion de riesgo personal/reputacional
- Scope prohibido:
  - normativa fiscal sin impacto laboral
  - contenidos de marketing/autoridad comercial

### Cuaderno 3 (Marca y posicionamiento)

- ID canonical: `ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO`
- Finalidad: motor comercial (autoridad -> conversion -> comisiones).
- Scope permitido:
  - posicionamiento premium inmobiliario
  - USP, diferenciacion, narrativa estrategica
  - uso de inteligencia de datos aplicada a conversion comercial
- Scope prohibido:
  - normativa fiscal/laboral no relacionada con conversion o posicionamiento
  - contenido tecnico-infraestructural sin impacto comercial

### Regla de aceptacion de fuentes (MCP)

1. Cada fuente debe etiquetarse con `notebook_id` y `domain`.
2. Debe declararse `reason_for_fit` explicando por que encaja en el cuaderno.
3. Si no encaja tematicamente, se rechaza con:
   - `SOURCE_SCOPE_MISMATCH`
   - `Decision=NO-GO` para esa tanda de ingesta.
