# 🔄 GUÍA DE MIGRACIÓN - Eliminar Antigravity

## ⚠️ ACCIÓN INMEDIATA

Todos los archivos generados anteriormente con referencias a **"Google Antigravity"** deben ser **DESCARTADOS** o **REFACTORADOS**.

---

## 📋 ARCHIVOS A DESCARTAR

### **En .antigravity/ (COMPLETA)**
- ❌ `.antigravity/agents/*.agent` (ficheros YAML ficticios)
- ❌ `.antigravity/prompts/features/*` (prompts duplicados)
- ❌ `.antigravity/README.md` (documentación ficticia)

### **En .agent/ (COMPLETA)**
- ❌ `.agent/rules/` (rules files YAML ficticios)
- ❌ `.agent/skills/` (skills files YAML ficticios)
- ❌ `.agent/README.md` (documentación ficticia)

### **En docs/ (REFACTORIZAR)**
- ❌ `docs/setup/antigravity_setup.md` (instrucciones ficticias)
- ⚠️ `docs/setup/installation.md` (ACTUALIZAR referencias)
- ⚠️ `docs/architecture/rag_architecture.md` (ACTUALIZAR con nueva arquitectura)

### **En raíz (ELIMINAR COMPLETAMENTE)**
- ❌ `.env.example` → Versión antigua con refs a Antigravity
- ⚠️ `README.md` → REESCRIBIR sin mencionar Antigravity

---

## ✅ ARCHIVOS A MANTENER

### **Base Real (Node.js + TypeScript)**
- ✅ `package.json` (dependencias correctas)
- ✅ `tsconfig.json` (configuración TypeScript)
- ✅ `database/schema.sql` (PostgreSQL correcto)
- ✅ `config/llm_config.json` (LLM config correcta)
- ✅ `config/embedding_config.json` (embeddings correcto)
- ✅ `config/rag_config.json` (RAG config correcto)
- ✅ `config/gem_sources.json` (GEMs config correcto)

### **Frontend (Next.js)**
- ✅ `src/app/layout.tsx` (layout base)
- ✅ `src/app/page.tsx` (home page)
- ✅ `src/app/globals.css` (estilos)

---

## 🔧 ARCHIVOS NUEVOS A AGREGAR

### **Orquestación (CRÍTICA)**
```
lib/agents/orchestrator.ts          ← RouterAgent + Specialists
src/app/api/chat/route.ts           ← API endpoint
```

### **Frontend (INTEGRACIÓN)**
```
src/hooks/useChat.ts                ← React hook
src/components/features/ChatInterface.tsx
src/components/features/MessageList.tsx
src/components/features/AlertsWidget.tsx
```

---

## 📝 REFACTORACIÓN DE DOCUMENTACIÓN

### **1. README.md - NUEVO CONTENIDO**

**Eliminar:**
```markdown
# Google Antigravity MCP Agents
# MCPs conectados: NotebookLM (32 herramientas)
```

**Reemplazar con:**
```markdown
# Anclora Advisor AI - Multi-Agent Orchestrator

Stack: Node.js 20 + TypeScript + Next.js 15 + Vercel AI SDK + Supabase

## Arquitectura

Router Agent (LLM) → Classifica → Specialist (Fiscal/Labor/Market)
                                   ↓
                                Recupera Contexto (Supabase)
                                   ↓
                                Genera Respuesta (LLM Specialist)
                                   ↓
                                Frontend (React Hook + Components)
```

### **2. installation.md - NUEVO CONTENIDO**

**Cambiar:**
```markdown
### Setup Antigravity
1. Ir a Google Antigravity Console
2. Conectar MCPs...
```

**Reemplazar con:**
```markdown
### Setup Backend

1. npm install
2. Crear base de datos en Supabase
3. npm run db:setup (ejecutar schema.sql)
4. npm run dev

API disponible en: http://localhost:3000/api/chat
```

### **3. Crear NEW docs/architecture/orchestrator.md**

```markdown
# Arquitectura del Orchestrator

## Componentes

1. **RouterAgent**: Clasifica consultas
2. **FiscalSpecialistTool**: RETA, IVA, ROAIIB
3. **LaborSpecialistTool**: Riesgo laboral, pluriactividad
4. **MarketSpecialistTool**: Análisis de mercado

## Flujo

User Query → API /chat/route.ts → Orchestrator.processQuery() → 
Router classifies → Specialist executes → Response → Frontend
```

---

## 🗑️ LIMPIEZA DE PROYECTO

### **Comando para eliminar carpetas ficticias:**
```bash
# SOLO si estás seguro de que tienes respaldos
rm -rf .agent/
rm -rf .antigravity/

# O mantenlas y simplemente no las uses
```

### **Actualizar .gitignore:**
```bash
# Agregar si quieres ignorar refs a Antigravity
.antigravity/
.agent/

# Mantener como archivos "históricos" sin usar
```

---

## 📦 VERIFICACIÓN FINAL

### **Estructura de carpetas correcta:**
```
anclora-advisor-ai/
├── lib/
│   └── agents/
│       └── orchestrator.ts          ✅ NUEVO
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts         ✅ NUEVO
│   │   ├── layout.tsx               ✅
│   │   ├── page.tsx                 ✅
│   │   └── globals.css              ✅
│   ├── hooks/
│   │   └── useChat.ts               ✅ NUEVO
│   ├── components/
│   │   └── features/
│   │       ├── ChatInterface.tsx    ✅ NUEVO
│   │       ├── MessageList.tsx      ✅ NUEVO
│   │       └── AlertsWidget.tsx     ✅ NUEVO
│   └── types/
│       └── index.ts                 ✅
├── database/
│   └── schema.sql                   ✅
├── config/
│   ├── llm_config.json              ✅
│   ├── embedding_config.json        ✅
│   ├── rag_config.json              ✅
│   └── gem_sources.json             ✅
├── package.json                     ✅ (actualizar deps)
├── tsconfig.json                    ✅
├── .env.example                     ✅ (ACTUALIZAR)
└── README.md                        ✅ (REESCRIBIR)

ELIMINAR:
❌ .agent/ (carpeta completa)
❌ .antigravity/ (carpeta completa)
```

---

## ✅ CHECKLIST DE MIGRACIÓN

- [ ] Descartar/eliminar `.agent/` folder
- [ ] Descartar/eliminar `.antigravity/` folder
- [ ] Copiar `orchestrator.ts` a `lib/agents/`
- [ ] Copiar `api-chat-route.ts` a `src/app/api/chat/route.ts`
- [ ] Copiar `useChat-hook.ts` a `src/hooks/useChat.ts`
- [ ] Copiar componentes a `src/components/features/`
- [ ] Actualizar `README.md` (sin refs a Antigravity)
- [ ] Actualizar `installation.md` (con nuevo setup)
- [ ] Actualizar `.env.example`
- [ ] Ejecutar `npm install` (verificar deps)
- [ ] Ejecutar `npm run dev` (probar funcionamiento)
- [ ] Verificar que `/api/chat` responde correctamente
- [ ] Probar chat en `http://localhost:3000`

---

## 🔗 REFERENCIAS ANTIGRAVITY A REMOVER

### **En archivos de documentación:**

1. Buscar: `"Google Antigravity"`
2. Reemplazar con: `"Multi-Agent Orchestrator (Node.js)"`

3. Buscar: `"MCP"`
4. Reemplazar con: `"Specialist Tools"`

5. Buscar: `"Antigravity Console"`
6. Reemplazar con: `"Next.js API"`

7. Buscar: `"Agent YAML files"`
8. Reemplazar con: `"Classes (Orchestrator.ts)"`

---

## 📞 RESUMEN

**Antigravity era:**
- ❌ Ficticio
- ❌ No existía en el stack real
- ❌ Causa confusión arquitectónica

**Ahora es:**
- ✅ Orchestrator.ts real
- ✅ Node.js 20 + TypeScript
- ✅ Next.js API Route funcional
- ✅ Integración clara con Frontend

**Tiempo estimado de refactor:** 30 minutos

---

**¡MIGRACIÓN LISTA PARA EJECUTAR!** 🚀
