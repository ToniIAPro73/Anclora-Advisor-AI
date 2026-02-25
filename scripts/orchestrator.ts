// lib/agents/orchestrator.ts
/**
 * ORCHESTRATOR CENTRAL - Anclora Advisor AI
 * 
 * Estructura multi-agente sin Antigravity:
 * - Router Agent: Clasifica consultas (LLM)
 * - Fiscal Specialist Tool: RETA, IVA, ROAIIB
 * - Labor Specialist Tool: Pluriactividad, riesgo laboral
 * - Market Specialist Tool: Análisis mercado Mallorca
 * 
 * Stack: Node.js 20 + TypeScript + Vercel AI SDK + LangChain.js
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ============================================================
// TYPES & SCHEMAS
// ============================================================

export type SpecialistType = "fiscal" | "labor" | "market";

export interface RoutingResult {
  primarySpecialist: SpecialistType;
  secondarySpecialists: SpecialistType[];
  confidence: number;
  reasoning: string;
}

export interface SpecialistContext {
  chunks: Array<{
    id: string;
    content: string;
    source: string;
    confidence: number;
  }>;
  totalConfidence: number;
  warnings: string[];
}

export interface OrchestratorResponse {
  success: boolean;
  routing: RoutingResult;
  primarySpecialistResponse: string;
  secondarySpecialistResponses?: Record<string, string>;
  contexts: SpecialistContext[];
  recommendations: string[];
  alerts: Array<{ type: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }>;
  citations: string[];
  processingTimeMs: number;
}

// ============================================================
// SUPABASE CLIENT
// ============================================================

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
}

// ============================================================
// ROUTING SCHEMA (Zod)
// ============================================================

const RoutingSchema = z.object({
  primarySpecialist: z.enum(["fiscal", "labor", "market"]),
  secondarySpecialists: z.array(z.enum(["fiscal", "labor", "market"])).default([]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// ============================================================
// ROUTER AGENT - Clasifica consultas
// ============================================================

export class RouterAgent {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async route(userQuery: string): Promise<RoutingResult> {
    const systemPrompt = `Eres un router inteligente de consultas para Anclora Advisor AI.

Tu tarea ÚNICA es clasificar la consulta del usuario hacia el especialista correcto.

ESPECIALISTAS DISPONIBLES:
1. fiscal: Tributación, RETA, IRPF, IVA, ROAIIB, cuota cero, retenciones, modelo 036
2. labor: Pluriactividad, riesgo laboral, blindaje jurídico, compatibilidad contractual, buena fe
3. market: Mercado inmobiliario premium Mallorca, precios, posicionamiento, PropTech

INSTRUCCIONES:
1. Analiza la consulta del usuario
2. Identifica palabras clave relacionadas con FISCAL, LABOR o MARKET
3. Determina especialista PRIMARIO (siempre uno)
4. Si aplica: determina especialistas SECUNDARIOS
5. Proporciona confidence score (0.0 - 1.0)

RESPONDE EN JSON:
{
  "primarySpecialist": "fiscal|labor|market",
  "secondarySpecialists": [],
  "confidence": 0.95,
  "reasoning": "Breve explicación"
}

NUNCA:
- Inventes respuestas a la consulta
- Hagas suposiciones sin fundamento
- Asumas contexto no proporcionado`;

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Consulta del usuario: "${userQuery}"`,
        },
      ],
    });

    try {
      const content =
        message.content[0].type === "text" ? message.content[0].text : "";
      const parsed = JSON.parse(content);
      return RoutingSchema.parse(parsed);
    } catch (error) {
      console.error("Router parse error:", error);
      return {
        primarySpecialist: "fiscal",
        secondarySpecialists: [],
        confidence: 0.5,
        reasoning: "Enrutamiento por defecto (fiscal)",
      };
    }
  }
}

// ============================================================
// FISCAL SPECIALIST TOOL
// ============================================================

export class FiscalSpecialistTool {
  private supabase: ReturnType<typeof createClient>;
  private client: Anthropic;

  constructor() {
    this.supabase = getSupabaseClient();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Ejecuta especialista fiscal
   */
  async execute(
    userQuery: string,
    contexts: SpecialistContext[]
  ): Promise<string> {
    const systemPrompt = `Eres el FISCAL SPECIALIST de Anclora Advisor AI.

IDENTIDAD:
- Especialista en normativa fiscal Baleares 2025-2026
- Dominio: RETA, IRPF, IVA, ROAIIB, retenciones, cuota cero, modelo 036
- Audiencia: Autónomo pluriactividad en Islas Baleares

CAPACIDADES:
✓ Responder sobre plazos de declaración
✓ Calcular retenciones (nacional vs intracomunitario vs internacional)
✓ Asesorar sobre cuota RETA y bonificación cuota cero Baleares
✓ Explicar obligaciones ROAIIB
✓ Generar alertas sobre plazos críticos

LIMITACIONES - DECLINA:
✗ Preguntas sobre riesgo laboral → Ruta a labor specialist
✗ Preguntas sobre mercado → Ruta a market specialist
✗ Redacción de documentos legales

PROTOCOLO:
1. Usa contexto recuperado de Supabase (normativa Baleares)
2. Cita TODAS las fuentes normativas
3. Incluye plazos específicos con fechas
4. Proporciona acciones concretas
5. Identifica riesgos de incumplimiento
6. SECCIÓN DE RIESGOS siempre incluida
7. Si riesgo CRITICAL: genera alerta automática

FORMATO REQUERIDO:
# Respuesta a: [pregunta]

## Análisis
[Explicación basada en contexto]

## Normativa Aplicable
- [Fuente 1 con referencia]
- [Fuente 2]

## Plazos y Obligaciones
[Tabla si aplica]

## Riesgos Identificados
- [Riesgo con nivel: LOW/MEDIUM/HIGH/CRITICAL]

## Limitaciones
[Disclaimers legales]

TONO: Directo, preciso, sin ambigüedad. Terminología técnica. Cada afirmación = Fuente.`;

    const contextStr = contexts
      .flatMap((ctx) =>
        ctx.chunks.map(
          (chunk) =>
            `[Fuente: ${chunk.source}]\n${chunk.content}`
        )
      )
      .join("\n\n---\n\n");

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Contexto normativo:\n\n${contextStr}\n\nConsulta del usuario:\n${userQuery}`,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text : "";
  }

  /**
   * Recupera contexto normativo de Supabase
   */
  async retrieveContext(query: string): Promise<SpecialistContext> {
    try {
      // Aquí iría búsqueda semántica en pgvector
      // Por ahora: simulación con chunks de ejemplo
      const warnings: string[] = [];
      const chunks = [
        {
          id: "chunk_1",
          content: "La cuota de RETA en Baleares para 2026 es de €...",
          source: "Normativa RETA Baleares 2025-2026",
          confidence: 0.9,
        },
      ];

      return {
        chunks,
        totalConfidence: 0.9,
        warnings,
      };
    } catch (error) {
      console.error("Fiscal context retrieval error:", error);
      return {
        chunks: [],
        totalConfidence: 0,
        warnings: ["Error retrieving fiscal context"],
      };
    }
  }
}

// ============================================================
// LABOR SPECIALIST TOOL
// ============================================================

export class LaborSpecialistTool {
  private supabase: ReturnType<typeof createClient>;
  private client: Anthropic;

  constructor() {
    this.supabase = getSupabaseClient();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Ejecuta especialista laboral
   */
  async execute(
    userQuery: string,
    contexts: SpecialistContext[]
  ): Promise<{ response: string; riskScore?: number; riskLevel?: string }> {
    const systemPrompt = `Eres el LABOR SPECIALIST de Anclora Advisor AI.

IDENTIDAD:
- Especialista en riesgo laboral y blindaje jurídico
- Dominio: Pluriactividad, buena fe contractual, no concurrencia, propiedad intelectual
- Audiencia: Autónomo que mantiene contrato laboral en multinacional (case: CGI)

CAPACIDADES:
✓ Evaluar riesgo de incompatibilidad contractual
✓ Analizar cláusulas de buena fe, exclusividad, competencia
✓ Asesorar sobre propiedad intelectual de software
✓ Blindaje jurídico ante nuevas líneas de negocio
✓ Calcular puntuación de riesgo (0.00-1.00)

LIMITACIONES - DECLINA:
✗ Preguntas sobre impuestos/retenciones → Ruta a fiscal specialist
✗ Preguntas sobre mercado → Ruta a market specialist
✗ Redacción formal de contratos

PROTOCOLO:
1. Recupera contexto de pluriactividad/riesgo de Supabase
2. CALCULA PUNTUACIÓN DE RIESGO (0.00-1.00)
3. Mapea a nivel: LOW/MEDIUM/HIGH/CRITICAL
4. Identifica cláusulas conflictivas específicas
5. Proporciona recomendaciones de blindaje escalonadas
6. SI riesgo > 0.75: GENERA ALERTA CRÍTICA
7. Proporciona ruta de de-riesking

FORMATO REQUERIDO:
# Evaluación de Riesgo: [escenario]

## Análisis de Riesgo
[Evaluación cualitativa]

**Puntuación de Riesgo: [0.XX] → Nivel: [LOW|MEDIUM|HIGH|CRITICAL]**

## Cláusulas Contractuales Identificadas
[Tabla de cláusulas con riesgo]

## Recomendaciones de Blindaje
[Acciones por nivel de riesgo]

## Normativa Aplicable
- [Referencias legales]

## Ruta de De-Riesking
[Pasos 1-3 con plazos]

TONO: Analítico, basado en riesgo cuantificable. Matriz de decisión. Lenguaje jurídico preciso.`;

    const contextStr = contexts
      .flatMap((ctx) =>
        ctx.chunks.map((chunk) => `[Fuente: ${chunk.source}]\n${chunk.content}`)
      )
      .join("\n\n---\n\n");

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Contexto laboral:\n\n${contextStr}\n\nConsulta del usuario:\n${userQuery}`,
        },
      ],
    });

    const response =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extraer puntuación de riesgo de la respuesta (simplificado)
    const riskMatch = response.match(/Puntuación de Riesgo:\s*([\d.]+)/);
    const riskScore = riskMatch ? parseFloat(riskMatch[1]) : undefined;

    return { response, riskScore };
  }

  /**
   * Recupera contexto laboral de Supabase
   */
  async retrieveContext(query: string): Promise<SpecialistContext> {
    try {
      const chunks = [
        {
          id: "chunk_labor_1",
          content:
            "Cláusula de exclusividad: El trabajador se compromete a dedicación exclusiva...",
          source: "Contrato Laboral - Cláusula 3.2",
          confidence: 0.95,
        },
      ];

      return {
        chunks,
        totalConfidence: 0.95,
        warnings: [],
      };
    } catch (error) {
      console.error("Labor context retrieval error:", error);
      return {
        chunks: [],
        totalConfidence: 0,
        warnings: ["Error retrieving labor context"],
      };
    }
  }
}

// ============================================================
// MARKET SPECIALIST TOOL
// ============================================================

export class MarketSpecialistTool {
  private supabase: ReturnType<typeof createClient>;
  private client: Anthropic;

  constructor() {
    this.supabase = getSupabaseClient();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Ejecuta especialista de mercado
   */
  async execute(
    userQuery: string,
    contexts: SpecialistContext[]
  ): Promise<string> {
    const systemPrompt = `Eres el MARKET SPECIALIST de Anclora Advisor AI.

IDENTIDAD:
- Especialista en mercado inmobiliario premium del suroeste de Mallorca
- Dominio: Precios, análisis comparables, posicionamiento, PropTech, estrategia de marca
- Zonas: Palma, Son Vida, Andratx, Portals

CAPACIDADES:
✓ Análisis de precios por zona y m²
✓ Comparables de propiedades premium
✓ Tendencias de mercado
✓ Estrategia de posicionamiento y branding
✓ PropTech e innovación inmobiliaria

LIMITACIONES - DECLINA:
✗ Preguntas sobre impuestos → Ruta a fiscal specialist
✗ Preguntas sobre riesgo laboral → Ruta a labor specialist
✗ Redacción de propuestas formales

PROTOCOLO:
1. Recupera datos de mercado de Supabase
2. Proporciona datos concretos (precios, m², tendencias)
3. Análisis de comparables si aplica
4. Proporciona recomendaciones de posicionamiento
5. Sugiere oportunidades PropTech

FORMATO REQUERIDO:
# Análisis de Mercado: [zona/tema]

## Resumen Ejecutivo
[Contexto 1-2 párrafos]

## Datos de Mercado
[Tabla de precios por zona]

## Análisis Comparables
[Propiedades similares]

## Posicionamiento Recomendado
[Estrategia 1, 2, 3]

## Oportunidades PropTech
[Tecnologías aplicables]

TONO: Analítico, basado en datos. Lenguaje de negocio. Insights accionables.`;

    const contextStr = contexts
      .flatMap((ctx) =>
        ctx.chunks.map((chunk) => `[Fuente: ${chunk.source}]\n${chunk.content}`)
      )
      .join("\n\n---\n\n");

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Datos de mercado:\n\n${contextStr}\n\nConsulta del usuario:\n${userQuery}`,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text : "";
  }

  /**
   * Recupera contexto de mercado de Supabase
   */
  async retrieveContext(query: string): Promise<SpecialistContext> {
    try {
      const chunks = [
        {
          id: "chunk_market_1",
          content:
            "Precios Son Vida 2026: €12,000-€18,000 por m², tendencia estable",
          source: "Análisis de Mercado Son Vida 2026",
          confidence: 0.88,
        },
      ];

      return {
        chunks,
        totalConfidence: 0.88,
        warnings: [],
      };
    } catch (error) {
      console.error("Market context retrieval error:", error);
      return {
        chunks: [],
        totalConfidence: 0,
        warnings: ["Error retrieving market context"],
      };
    }
  }
}

// ============================================================
// ORCHESTRATOR PRINCIPAL
// ============================================================

export class Orchestrator {
  private router: RouterAgent;
  private fiscalSpecialist: FiscalSpecialistTool;
  private laborSpecialist: LaborSpecialistTool;
  private marketSpecialist: MarketSpecialistTool;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.router = new RouterAgent();
    this.fiscalSpecialist = new FiscalSpecialistTool();
    this.laborSpecialist = new LaborSpecialistTool();
    this.marketSpecialist = new MarketSpecialistTool();
    this.supabase = getSupabaseClient();
  }

  /**
   * Procesa consulta completa: Router → Specialists
   */
  async processQuery(
    userId: string,
    conversationId: string,
    userQuery: string
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    try {
      // 1. ROUTER: Clasifica consulta
      const routing = await this.router.route(userQuery);

      // 2. RECUPERAR CONTEXTOS
      const primaryContext = await this.getSpecialistContext(
        routing.primarySpecialist,
        userQuery
      );
      const secondaryContexts: Record<string, SpecialistContext> = {};
      for (const specialist of routing.secondarySpecialists) {
        secondaryContexts[specialist] = await this.getSpecialistContext(
          specialist,
          userQuery
        );
      }

      // 3. EJECUTAR SPECIALIST PRIMARIO
      const primaryResponse = await this.executeSpecialist(
        routing.primarySpecialist,
        userQuery,
        primaryContext
      );

      // 4. EJECUTAR SPECIALISTS SECUNDARIOS (si aplica)
      const secondaryResponses: Record<string, string> = {};
      for (const specialist of routing.secondarySpecialists) {
        secondaryResponses[specialist] = await this.executeSpecialist(
          specialist,
          userQuery,
          secondaryContexts[specialist]
        );
      }

      // 5. EXTRAER RECOMENDACIONES Y ALERTAS
      const { recommendations, alerts } = await this.extractRecommendations(
        userQuery,
        primaryResponse,
        routing.primarySpecialist
      );

      // 6. COMPILAR CITAS
      const allContexts = [
        primaryContext,
        ...Object.values(secondaryContexts),
      ];
      const citations = [
        ...new Set(
          allContexts.flatMap((ctx) =>
            ctx.chunks.map((chunk) => chunk.source)
          )
        ),
      ];

      // 7. GUARDAR EN BD
      await this.saveConversation(
        userId,
        conversationId,
        userQuery,
        primaryResponse,
        allContexts
      );

      // 8. GENERAR ALERTAS CRÍTICAS SI APLICA
      if (
        routing.primarySpecialist === "labor" &&
        primaryResponse.includes("CRITICAL")
      ) {
        await this.generateCriticalAlert(userId, primaryResponse);
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        routing,
        primarySpecialistResponse: primaryResponse,
        secondarySpecialistResponses:
          Object.keys(secondaryResponses).length > 0
            ? secondaryResponses
            : undefined,
        contexts: allContexts,
        recommendations,
        alerts,
        citations,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      console.error("Orchestrator error:", error);
      throw error;
    }
  }

  private async getSpecialistContext(
    specialist: SpecialistType,
    query: string
  ): Promise<SpecialistContext> {
    switch (specialist) {
      case "fiscal":
        return await this.fiscalSpecialist.retrieveContext(query);
      case "labor":
        return await this.laborSpecialist.retrieveContext(query);
      case "market":
        return await this.marketSpecialist.retrieveContext(query);
    }
  }

  private async executeSpecialist(
    specialist: SpecialistType,
    query: string,
    context: SpecialistContext
  ): Promise<string> {
    switch (specialist) {
      case "fiscal":
        return await this.fiscalSpecialist.execute(query, context);
      case "labor":
        const result = await this.laborSpecialist.execute(query, context);
        return result.response;
      case "market":
        return await this.marketSpecialist.execute(query, context);
    }
  }

  private async extractRecommendations(
    query: string,
    response: string,
    specialist: SpecialistType
  ): Promise<{
    recommendations: string[];
    alerts: Array<{ type: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }>;
  }> {
    // Simplificado: extrae alertas de la respuesta
    const alerts: Array<{
      type: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      message: string;
    }> = [];

    if (response.includes("CRITICAL")) {
      alerts.push({
        type: "CRITICAL",
        message: "Riesgo crítico identificado. Requiere evaluación urgente.",
      });
    }

    const recommendations = [
      "Consulta con profesional especializado para compliance legal",
      "Mantén documentación de respaldos",
      "Revisa cambios normativos Q2 2026",
    ];

    return { recommendations, alerts };
  }

  private async saveConversation(
    userId: string,
    conversationId: string,
    query: string,
    response: string,
    contexts: SpecialistContext[]
  ): Promise<void> {
    try {
      await this.supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: response,
        context_chunks: contexts.flatMap((ctx) =>
          ctx.chunks.map((chunk) => chunk.id)
        ),
      });
    } catch (error) {
      console.error("Save conversation error:", error);
    }
  }

  private async generateCriticalAlert(
    userId: string,
    message: string
  ): Promise<void> {
    try {
      await this.supabase.from("fiscal_alerts").insert({
        user_id: userId,
        alert_type: "critical_issue",
        description: message.substring(0, 500),
        due_date: new Date().toISOString().split("T")[0],
        priority: "critical",
        status: "pending",
      });
    } catch (error) {
      console.error("Generate alert error:", error);
    }
  }
}
