# ADMIN-INGEST-001

## Objetivo
- Exponer una API admin de ingesta protegida por RBAC.
- Validar `project_ref` canónico y scope de NotebookLM antes de escribir en Supabase.
- Crear/actualizar documentos y chunks con embeddings locales para dejar la fuente operativa al terminar la petición.

## Endpoint
- `POST /api/admin/rag/ingest`

## Validaciones
- Solo `admin`.
- `project_ref` obligatorio: `lvpplnqbyvscpuljnzqf`
- Coherencia de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL` deben apuntar al mismo proyecto canónico.
- Cada source debe llevar `reason_for_fit`.
- Si el source no encaja con el notebook destino:
  - `SOURCE_SCOPE_MISMATCH`
  - `Decision=NO-GO`

## Comportamiento
- `dry_run=true`: solo valida.
- `replace_existing=true` por defecto: reemplaza chunks existentes del documento.
- Genera embeddings locales con `all-minilm` via Ollama.

## Herramientas auxiliares
- `npm run -s rbac:set-role -- --role admin --email usuario@dominio.com`
