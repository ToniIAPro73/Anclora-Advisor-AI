# rag-ingestion-and-notebooklm-sync-test-plan-v1

Feature ID: `ANCLORA-RAG-INGEST-001`

## Scope

- Flujo MCP NotebookLM -> normalizacion -> chunking -> embeddings -> Supabase.
- Integracion de retrieval/citas en chat.

## Casos funcionales

1. Conectar MCP y listar 3 cuadernos objetivo.
2. Extraer contenido y metadatos por cuaderno.
3. Persistir registros en `rag_documents`.
4. Persistir chunks en `rag_chunks` con embeddings dimension 384.
5. **Pruebas de Aceptación (Retrieval y Citas)**:
   - **Test 1 (Fiscal)**: "¿Cuáles son los plazos del IVA?"
     - Esperado: El sistema recupera chunks del cuaderno `fiscal` y responde citando la fuente.
   - **Test 2 (Laboral)**: "¿Qué riesgos tiene la pluriactividad?"
     - Esperado: El sistema recupera chunks del cuaderno `laboral` y responde citando la fuente.
   - **Test 3 (Mercado)**: "¿Cómo tributa la venta de una vivienda?"
     - Esperado: El sistema recupera chunks del cuaderno `mercado` y responde citando la fuente.
   - **Test 4 (Integridad)**: Verificar que no hay duplicación de chunks al re-ingerir el mismo cuaderno.
6. Verificar que la UI del chat muestra las citas de forma desplegable y correcta.

## Casos de error

1. Cuaderno inaccesible por MCP.
2. Embedding generation failure.
3. Insercion parcial en DB.
4. Respuesta sin evidencia recuperada.

## Checks tecnicos

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`

## Criterio de cierre

Feature solo cierra en `GO` tras ejecucion real con evidencia completa.

