<!-- ANCLORA-ECOSYSTEM-CONTEXT-START -->
### Memoria de ecosistema Anclora

El ecosistema Anclora tiene arquitecturas distintas por producto. Antes de actuar sobre despliegues, bases de datos, auth o variables, todo agente debe consultar `.anclora/global/ANCLORA_ECOSYSTEM_CONTEXT.md` y el contrato canónico `ANCLORA_ECOSYSTEM_ARCHITECTURE_CONTRACT.md` en Boveda-Anclora.

Caso crítico conocido: Anclora Nexus usa frontend en Vercel (`/frontend`), backend en Render (`/backend`) y Supabase para Auth/DB. No usar Neon como sustituto directo de Supabase en Nexus sin rediseñar auth/datos. No hay Supabase Pro/Branching ni segundo proyecto Supabase si exige upgrade; staging requiere flags/guards si comparte Supabase.
<!-- ANCLORA-ECOSYSTEM-CONTEXT-END -->
