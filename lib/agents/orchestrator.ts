// lib/agents/orchestrator.ts
/**
 * ORCHESTRATOR CENTRAL - Anclora Advisor AI
 * Stack: Node.js 20 + TypeScript + Vercel AI SDK + LangChain.js
 */

import { createClient } from "@supabase/supabase-js";

export type SpecialistType = "fiscal" | "labor" | "market";

export interface RoutingResult {
  primarySpecialist: SpecialistType;
  secondarySpecialists: SpecialistType[];
  confidence: number;
  reasoning: string;
}

export interface SpecialistContext {
  chunks: Array<{ id: string; content: string; source: string; confidence: number; }>;
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
}

export class Orchestrator {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || "https://placeholder.supabase.co", 
      process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
    );
  }

  async processQuery(userId: string, conversationId: string, query: string): Promise<OrchestratorResponse> {
    // 1. Clasificación estática/simulada (Reemplazar con llamada real a Vercel AI SDK/LLM)
    let selectedSpecialist: SpecialistType = "fiscal";
    let reasoning = "Consulta general clasificada como fiscal por defecto.";

    if (query.toLowerCase().includes("despido") || query.toLowerCase().includes("laboral")) {
      selectedSpecialist = "labor";
      reasoning = "Se detectaron términos relacionados con riesgo laboral y pluriactividad.";
    } else if (query.toLowerCase().includes("mercado") || query.toLowerCase().includes("mallorca")) {
      selectedSpecialist = "market";
      reasoning = "Se detectaron términos de análisis inmobiliario local.";
    }

    const routing: RoutingResult = {
      primarySpecialist: selectedSpecialist,
      secondarySpecialists: [],
      confidence: 0.92,
      reasoning
    };

    // 2. Mock de respuesta del especialista y alertas
    const response = "Esta es una respuesta validada por el especialista " + selectedSpecialist + ". Basado en la normativa de Baleares, asegúrate de documentar todo correctamente.";
    const alerts: Array<{ type: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }> = [];

    if (selectedSpecialist === "labor") {
      alerts.push({ type: "CRITICAL", message: "Riesgo crítico identificado por posible transgresión de buena fe. Requiere evaluación urgente." });
    }

    const result: OrchestratorResponse = {
      success: true,
      routing,
      primarySpecialistResponse: response,
      contexts: [],
      recommendations: [
        "Consulta con profesional especializado para compliance legal",
        "Mantén documentación de respaldos"
      ],
      alerts,
      citations: ["Marco normativo RETA/Pluriactividad 2025-2026"]
    };

    // 3. Guardar contexto y registro asíncrono
    await this.saveConversation(userId, conversationId, query, response, result.contexts);
    return result;
  }

  private async saveConversation(userId: string, conversationId: string, query: string, response: string, contexts: SpecialistContext[]): Promise<void> {
    try {
      await this.supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: response,
        context_chunks: contexts.flatMap((ctx) => ctx.chunks.map((chunk) => chunk.id)),
      });
    } catch (error) {
      console.error("Save conversation error:", error);
    }
  }
}
