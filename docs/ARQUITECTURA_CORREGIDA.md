# 🔧 ARQUITECTURA CORREGIDA - Multi-Agent Orchestrator

## ⚠️ CORRECCIÓN CRÍTICA

Se eliminó completamente la dependencia ficticia a **"Google Antigravity"** y se implementó la **arquitectura real** usando:
- ✅ **Node.js 20** + TypeScript
- ✅ **Vercel AI SDK** + **LangChain.js/LangGraph.js**
- ✅ **Next.js 15 API Routes** como orquestación
- ✅ **Supabase PostgreSQL + pgvector** para contexto
- ✅ **React Hooks** para integración Frontend

---

## 🏗️ NUEVA ARQUITECTURA

### **ANTES (Alucinación):**
```
User Query
    ↓
Google Antigravity Router Agent (FICTICIO)
    ↓
Antigravity Fiscal Specialist (FICTICIO)
```

### **AHORA (Real):**
```
┌─────────────────────────────────────────────────────────────┐
│                    USER QUERY                               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│  ORCHESTRATOR (lib/agents/orchestrator.ts)                 │
│  - Instancia global única                                 │
│  - Coordina Router + 3 Specialists                        │
│  - Maneja errores y escalado                              │
└────────────────────┬──────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌─────────┐
    │Router  │  │Retrieve│  │Context  │
    │Agent   │──│Context │──│Validator│
    │(LLM)   │  │(Supabase)  │        │
    └────┬───┘  └────────┘  └─────────┘
         │
    ┌────▼─────────────────────────────┐
    │  EJECUTAR SPECIALIST CORRECTO    │
    │  (Fiscal/Labor/Market)           │
    │  - Cada uno es una clase TsClass │
    │  - Recupera contexto de Supabase │
    │  - Genera respuesta con citas    │
    └────┬─────────────────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │  RESPONSE VALIDATOR              │
    │  - Extrae recomendaciones        │
    │  - Genera alertas críticas       │
    │  - Compila citas                 │
    └────┬─────────────────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │  API RESPONSE (/api/chat)        │
    │  { routing, response, alerts... }│
    └────┬─────────────────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │  FRONTEND (useChat Hook)         │
    │  - ChatInterface Component       │
    │  - MessageList Component         │
    │  - Renderiza con metadata        │
    └─────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS CORREGIDA

```
src/
├── app/
│   └── api/
│       └── chat/
│           └── route.ts          ← Endpoint POST /api/chat
│
├── lib/
│   └── agents/
│       └── orchestrator.ts       ← ORQUESTADOR CENTRAL
│                                   • RouterAgent class
│                                   • FiscalSpecialistTool class
│                                   • LaborSpecialistTool class
│                                   • MarketSpecialistTool class
│                                   • Orchestrator class (coordinador)
│
├── hooks/
│   └── useChat.ts                ← React Hook para Frontend
│                                   • Abstrae Orchestrator
│                                   • Maneja estado de chat
│                                   • Convierte respuesta a ChatMessage
│
└── components/
    └── features/
        ├── ChatInterface.tsx     ← Componente principal
        └── MessageList.tsx       ← Renderiza mensajes
```

---

## 🔄 FLUJO CORRECTO

### **PASO 1: Usuario escribe query en Frontend**
```typescript
// src/components/features/ChatInterface.tsx
const { sendMessage } = useChat(userId, conversationId);
await sendMessage("¿Cuál es el plazo para presentar IVA?");
```

### **PASO 2: Hook envía POST a /api/chat**
```typescript
// src/hooks/useChat.ts
POST /api/chat
Body: { userId, conversationId, query }
```

### **PASO 3: API Route crea Orchestrator**
```typescript
// src/app/api/chat/route.ts
const orchestrator = new Orchestrator();
const result = await orchestrator.processQuery(userId, conversationId, query);
```

### **PASO 4: Orchestrator ejecuta flujo completo**
```typescript
// lib/agents/orchestrator.ts
// 1. Router clasifica → "fiscal_specialist"
const routing = await this.router.route(userQuery);

// 2. Recupera contexto normativo de Supabase
const context = await this.fiscalSpecialist.retrieveContext(query);

// 3. Ejecuta Fiscal Specialist (LLM)
const response = await this.fiscalSpecialist.execute(query, context);

// 4. Extrae recomendaciones y alertas
const { recommendations, alerts } = await this.extractRecommendations(...);

// 5. Guarda en BD
await this.saveConversation(...);

// 6. Retorna resultado
return { routing, response, alerts, citations, ... };
```

### **PASO 5: Frontend renderiza respuesta**
```typescript
// src/components/features/MessageList.tsx
// Renderiza:
// - Contenido de respuesta
// - Indicador de specialist (fiscal)
// - Confianza del router (0.95)
// - Alertas críticas si aplica
// - Citas normativas
```

---

## 🎯 CLASES DEL ORCHESTRATOR

### **RouterAgent**
```typescript
class RouterAgent {
  async route(userQuery: string): Promise<RoutingResult>
}

// Input: "¿Cuál es el plazo para presentar IVA?"
// Output: {
//   primarySpecialist: "fiscal",
//   confidence: 0.95,
//   reasoning: "Pregunta sobre plazo de declaración"
// }
```

### **FiscalSpecialistTool**
```typescript
class FiscalSpecialistTool {
  async execute(userQuery: string, context: SpecialistContext): Promise<string>
  async retrieveContext(query: string): Promise<SpecialistContext>
}

// Recupera: Normativa RETA, IVA, ROAIIB de Supabase
// Genera: Respuesta con plazos + citas
```

### **LaborSpecialistTool**
```typescript
class LaborSpecialistTool {
  async execute(userQuery: string, context: SpecialistContext): Promise<{response, riskScore}>
  async retrieveContext(query: string): Promise<SpecialistContext>
}

// Recupera: Contexto pluriactividad, cláusulas contractuales
// Genera: Evaluación de riesgo (0.00-1.00) + recomendaciones
```

### **MarketSpecialistTool**
```typescript
class MarketSpecialistTool {
  async execute(userQuery: string, context: SpecialistContext): Promise<string>
  async retrieveContext(query: string): Promise<SpecialistContext>
}

// Recupera: Datos de mercado (precios, m², zonas)
// Genera: Análisis con estrategia de posicionamiento
```

### **Orchestrator (Coordinador Principal)**
```typescript
class Orchestrator {
  async processQuery(userId, conversationId, userQuery): Promise<OrchestratorResponse>
}

// Coordina TODOS los pasos del flujo
// - Crea Router
// - Crea Specialists
// - Ejecuta secuencia
// - Guarda en BD
// - Retorna resultado consolidado
```

---

## 📊 EJEMPLO DE EJECUCIÓN COMPLETA

### **Query de Usuario:**
```
"¿Puedo lanzar una consultora de IA mientras trabajo en CGI?"
```

### **Router clasifica:**
```json
{
  "primarySpecialist": "labor",
  "secondarySpecialists": ["fiscal"],
  "confidence": 0.92,
  "reasoning": "Pregunta sobre pluriactividad y compatibilidad laboral"
}
```

### **Labor Specialist ejecuta:**
```
1. Recupera contexto:
   - Cláusula de exclusividad del contrato
   - Normativa sobre buena fe contractual
   - Jurisprudencia sobre competencia

2. Calcula riesgo: 0.78 → NIVEL: HIGH

3. Identifica cláusulas:
   - Exclusividad (violación: 0.85)
   - No competencia (violación: 0.65)

4. Propone blindaje:
   - Contactar abogado laboral
   - Solicitar enmienda formal
   - Establecer segregación de repositorios

5. Genera alerta CRITICAL (riesgo > 0.75)
```

### **Fiscal Specialist ejecuta (secundario):**
```
1. Recupera contexto:
   - Impacto fiscal de consultora
   - Régimen de retenciones

2. Proporciona análisis:
   - Base liquidable
   - Cuota RETA aplicable
   - Retenciones por cliente tipo
```

### **Respuesta Consolidada al Usuario:**
```json
{
  "success": true,
  "routing": {
    "primarySpecialist": "labor",
    "secondarySpecialists": ["fiscal"],
    "confidence": 0.92
  },
  "primarySpecialistResponse": "# Evaluación de Riesgo: Lanzar Consultora IA\n\n**Puntuación de Riesgo: 0.78 → NIVEL: HIGH**\n\n## Cláusulas Contractuales Identificadas\n...",
  "secondarySpecialistResponses": {
    "fiscal": "# Impacto Fiscal\n...",
  },
  "alerts": [
    {
      "type": "CRITICAL",
      "message": "Riesgo contractual alto (0.78). Requiere consulta inmediata con abogado laboral."
    }
  ],
  "citations": [
    "Estatuto de los Trabajadores - Art. 22",
    "Código Civil - Art. 1262",
    "Jurisprudencia TS sobre buena fe"
  ],
  "recommendations": [
    "Contactar abogado laboral especializado",
    "Solicitar enmienda formal a contrato",
    "Documentar separación de repositorios"
  ],
  "processingTimeMs": 3421
}
```

---

## 🔌 INTEGRACIÓN CON FRONTEND

### **useChat Hook:**
```typescript
const { sendMessage, messages, loading } = useChat(userId, conversationId);

// Interno:
// - Convierte respuesta OrchestratorResponse → ChatMessage[]
// - Renderiza automáticamente routing info
// - Muestra alertas críticas
// - Expande citas
```

### **ChatInterface Component:**
```typescript
<ChatInterface userId="uuid" conversationId="uuid" />

// Renderiza:
// - MessageList con historial
// - AlertsWidget si hay alertas críticas
// - Input form para nuevas queries
// - Selector de specialist (testing)
```

---

## ✅ PUNTOS CRÍTICOS CORREGIDOS

| Problema | Antes | Ahora |
|----------|-------|-------|
| **Orquestación** | Antigravity ficticio | Orchestrator.ts real |
| **Router** | Agent YAML | RouterAgent class (LLM) |
| **Specialists** | Agents Antigravity | Classes (Fiscal/Labor/Market) |
| **Contexto** | MCP ficticio | Supabase pgvector real |
| **API** | Ficticia | Next.js /api/chat funcional |
| **Frontend** | Componentes sin logic | useChat Hook + Components |
| **Stack** | Mentira | Node.js 20 + TypeScript + Vercel AI SDK |

---

## 🚀 PRÓXIMOS PASOS

1. **Copiar `orchestrator.ts`** → `lib/agents/`
2. **Copiar `api-chat-route.ts`** → `src/app/api/chat/route.ts`
3. **Copiar `useChat-hook.ts`** → `src/hooks/useChat.ts`
4. **Copiar componentes** → `src/components/features/`
5. **npm install** (todas las deps están en package.json)
6. **npm run dev** y probar en `http://localhost:3000/chat`

---

**Disculpa por la alucinación inicial. Esta es la arquitectura REAL y funcional.** ✅
