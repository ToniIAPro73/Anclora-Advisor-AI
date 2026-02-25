# PLAN DE MEJORA

Fecha de elaboración: 25-02-2026
Horizonte sugerido: 4 semanas

## Objetivo
Llevar el repositorio desde un estado de prototipo inestable a una base de producto confiable, compilable y extensible.

## Principios de ejecución
- Priorizar estabilidad antes de nuevas capacidades.
- Reducir deuda de tipado y build primero.
- Entregar mejoras en incrementos pequeños y verificables.

## Fase 1 (Semana 1): Estabilización técnica

### Acciones
1. Corregir estrategia de imports/alias.
2. Restringir `tsconfig.json` para excluir `scripts/` del build principal.
3. Instalar y configurar dependencias mínimas de calidad:
   - `eslint`, `eslint-config-next`
   - `@types/react`, `@types/react-dom`
   - `lucide-react` (si se mantiene su uso)
   - paquetes de Tailwind si se confirma su uso en UI.
4. Asegurar que `npm run type-check` y `npm run lint` finalicen en verde.

### Criterio de salida
- Build local sin errores.
- Lint y type-check sin bloqueantes.

## Fase 2 (Semana 2): Integración funcional end-to-end

### Acciones
1. Conectar `src/app/page.tsx` con `ChatInterface` (o crear ruta dedicada `/chat`).
2. Normalizar contrato de respuesta en `/api/chat` y hook `useChat`.
3. Completar persistencia de conversación:
   - guardar mensaje de usuario y asistente.
   - validar IDs de conversación/usuario.
4. Revisar manejo de errores (mensajes seguros y trazables).

### Criterio de salida
- Flujo UI -> API -> persistencia funcionando con datos reales de prueba.
- Usuario puede enviar consulta y ver respuesta con metadatos.

## Fase 3 (Semana 3): Seguridad, configuración y datos

### Acciones
1. Endurecer gestión de variables de entorno:
   - separar server-only y client-safe.
   - documentar obligatorias/opcionales en `.env.example`.
2. Revisar uso de `SUPABASE_SERVICE_ROLE_KEY` para no exponerlo fuera de backend.
3. Validar políticas RLS y consistencia de esquema con acceso real.
4. Agregar validación de input con `zod` en `/api/chat`.

### Criterio de salida
- Configuración reproducible y segura.
- API con validación robusta y errores controlados.

## Fase 4 (Semana 4): Calidad continua y evolución del orquestador

### Acciones
1. Introducir tests mínimos:
   - unitarios para `orchestrator`.
   - integración para `/api/chat`.
2. Implementar CI (por ejemplo: type-check + lint + tests en PR).
3. Reconciliar documentación:
   - README operativo real.
   - arquitectura alineada con implementación actual.
4. Plan de evolución del orquestador:
   - reemplazar routing por keywords con clasificación LLM/heurística híbrida.
   - trazabilidad de contexto y citas.

### Criterio de salida
- PRs con validación automática.
- Documentación coherente con el código.
- Hoja de ruta técnica clara del motor multi-especialista.

## Backlog priorizado (Top 10)
1. Corregir alias de import `@/lib/...` vs ubicación real.
2. Excluir `scripts/` de compilación TS principal.
3. Instalar stack mínimo de lint/tipos faltantes.
4. Resolver dependencia `lucide-react`.
5. Verificar/instalar Tailwind o retirar sus directivas.
6. Integrar pantalla de chat en la entrada de la app.
7. Persistir ambos roles (`user`, `assistant`) en `messages`.
8. Definir esquema de errores API consistente.
9. Añadir tests de contrato para `/api/chat`.
10. Actualizar README con quickstart reproducible.

## Métricas de éxito sugeridas
- `type-check`: 0 errores.
- `lint`: 0 errores.
- Cobertura inicial: >= 40% en módulos críticos.
- Tiempo de respuesta p95 en `/api/chat`: < 2.5 s (entorno local con mocks).
- Tasa de fallos 5xx en pruebas de integración: 0%.
