# Agent D - QA

Validar:

1. `AI_RUNTIME_PROFILE=local` conserva compatibilidad.
2. Los perfiles cloud resuelven config sin exponer secretos al cliente.
3. La dimension esperada de embeddings queda protegida.
4. `/api/chat` mantiene contrato y build type-safe.

Checks:

- `npm run -s lint`
- `npm run -s type-check`
- `npm run -s build`
- `npm run -s test:ai-runtime-profile`
