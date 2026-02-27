# QA Gate Baseline

## Validacion de entorno (obligatoria)

- Leer `.env.local` y `.env.example`.
- Verificar consistencia de variables de servidor y cliente para API/chat.
- Prohibido usar valores hardcodeados ajenos al entorno activo.
- Verificar `project_ref` unico y consistente entre:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Si hay refs distintos: reportar `ENV_MISMATCH=SUPABASE_PROJECT_REF_CONFLICT`.
- Registrar evidencia de preflight (fuente y fecha de validacion).

## Validacion i18n (obligatoria)

- Todo texto nuevo/modificado visible en UI debe existir en:
  - `es`
  - `en`
- Si faltan claves: reportar `I18N_MISSING_KEYS`.

## Validacion de migracion (obligatoria si aplica)

- Si la feature toca Supabase, QA debe confirmar migraciones aplicadas.
- Sin evidencia de migracion aplicada: reportar `MIGRATION_NOT_APPLIED`.

## Validacion de alcance de fuentes (obligatoria para RAG/NotebookLM)

- Toda fuente ingerida debe estar alineada con el cuaderno destino.
- Debe existir evidencia de `reason_for_fit` por fuente.
- Si una fuente no encaja en la tematica del cuaderno: `SOURCE_SCOPE_MISMATCH`.

## Criterios NO-GO

- Errores en `lint`, `type-check` o `build`.
- Regresion funcional en `/api/chat`.
- Errores P0 en chat UI.
- Fugas de datos sensibles en logs o respuestas.
- `I18N_MISSING_KEYS` distinto de none.
- `MIGRATION_NOT_APPLIED` distinto de none.
- `ENV_MISMATCH` distinto de none.
- `SUPABASE_PROJECT_REF_CONFLICT` distinto de none.
- `SOURCE_SCOPE_MISMATCH` distinto de none.

## Cierre GO

- Checks en verde.
- Contrato API verificado.
- Evidencia documentada en `sdd/features/<feature>/`.
