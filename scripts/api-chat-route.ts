// src/app/api/chat/route.ts
/**
 * API ENDPOINT: Procesa queries multi-especialista
 * 
 * POST /api/chat
 * Body: { userId, conversationId, query }
 * 
 * Flujo:
 * 1. Recibe consulta del usuario
 * 2. Pasa a Orchestrator
 * 3. Router clasifica → Specialist adecuado
 * 4. Specialist recupera contexto de Supabase
 * 5. Genera respuesta con citas
 * 6. Retorna al frontend
 */

import { NextRequest, NextResponse } from "next/server";
import { Orchestrator } from "@/lib/agents/orchestrator";

// Instancia global del orchestrator
const orchestrator = new Orchestrator();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validaciones
    if (!body.userId || !body.conversationId || !body.query) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, conversationId, query",
        },
        { status: 400 }
      );
    }

    // Procesar query a través del orchestrator
    const result = await orchestrator.processQuery(
      body.userId,
      body.conversationId,
      body.query
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error processing query",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Chat API is running",
    endpoint: "POST /api/chat",
    requiredFields: ["userId", "conversationId", "query"],
  });
}
