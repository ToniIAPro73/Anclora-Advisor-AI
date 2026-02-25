# AGENTS.md

## Objetivo del repositorio
Anclora Advisor AI es una aplicación web para consultas de asesoría fiscal, laboral y mercado inmobiliario con arquitectura Next.js + TypeScript + Supabase.

## Stack actual
- Next.js 15 + React 19
- TypeScript
- Supabase (`@supabase/supabase-js`)
- API route en `src/app/api/chat/route.ts`

## Estructura relevante
- `src/app/`: App Router y endpoints API.
- `src/components/features/`: UI de chat.
- `src/hooks/`: lógica cliente (`useChat`).
- `lib/agents/`: orquestador backend.
- `supabase/migrations/`: esquema SQL.
- `docs/`: arquitectura, análisis y planes.
- `scripts/`: artefactos de migración/prototipos (no fuente principal de runtime).

## Convenciones de trabajo
- Priorizar cambios en `src/`, `lib/` y `supabase/`.
- Mantener tipado estricto y evitar `any`.
- No exponer secretos en cliente; claves sensibles solo en servidor.
- Actualizar documentación en `docs/` cuando cambie arquitectura o flujo.

## Comandos útiles
- `npm run dev`: desarrollo local.
- `npm run build`: build de producción.
- `npm run type-check`: validación TypeScript.
- `npm run lint`: lint (requiere ESLint instalado).

## Checklist mínimo antes de merge
- `type-check` sin errores.
- `lint` sin errores.
- Endpoint `/api/chat` responde con contrato esperado.
- Flujo UI principal visible desde `src/app/page.tsx`.
- Variables de entorno documentadas en `.env.example`.
