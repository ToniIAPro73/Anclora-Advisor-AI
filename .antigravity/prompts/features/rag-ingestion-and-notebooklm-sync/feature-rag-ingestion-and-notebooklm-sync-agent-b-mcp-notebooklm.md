# Agent B (MCP NotebookLM) - rag-ingestion-and-notebooklm-sync

Objetivo: extraer y normalizar contenido de 3 cuadernos via MCP.

Entradas requeridas:

- `NOTEBOOK_1_ID`
- `NOTEBOOK_2_ID`
- `NOTEBOOK_3_ID`
- `MCP_NOTEBOOKLM_PROVIDER`

Secuencia requerida:

1. Conectar al proveedor MCP de NotebookLM.
2. Leer metadatos de cada cuaderno (titulo, idioma, fecha, fuentes si existen).
3. Exportar contenido util para RAG (texto limpio, no prompts internos).
4. Normalizar:
   - eliminar ruido de formato
   - conservar encabezados/secciones relevantes
   - preservar trazabilidad de origen
   - anadir `reason_for_fit` por fuente
5. Entregar bundle estructurado por cuaderno listo para chunking.

Validaciones:

- Si un cuaderno no es accesible, reportar bloqueo y detener.
- No incluir secretos o datos no permitidos en artefactos exportados.
- Si una fuente no encaja en la tematica de su cuaderno: `SOURCE_SCOPE_MISMATCH` y detener.

Salida esperada:

- `notebook_bundle_v1` con 3 cuadernos normalizados y trazables.
