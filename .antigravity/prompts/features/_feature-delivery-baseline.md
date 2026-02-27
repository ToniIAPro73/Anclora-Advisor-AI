# Feature Delivery Baseline

1. Resumir alcance, riesgos, dependencias y contratos afectados.
2. Ejecutar preflight de entorno (incluye coherencia de `project_ref` Supabase).
3. Definir plan tecnico por capas (DB -> backend -> frontend -> QA).
4. Congelar contrato antes de implementar.
5. Si la feature toca NotebookLM/RAG, validar alineacion de fuentes por cuaderno (scope tematico).
6. Implementar cambios minimos con tipado estricto y sin secretos.
7. Ejecutar `lint`, `type-check`, `build`.
8. Verificar `/api/chat` en exito/error y edge cases.
9. Registrar evidencias y riesgos residuales en SDD.
