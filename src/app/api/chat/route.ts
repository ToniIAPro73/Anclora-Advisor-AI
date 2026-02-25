// src/app/api/chat/route.ts
/**
 * API ENDPOINT: Procesa queries multi-especialista
 * * POST /api/chat
 * Body: { userId, conversationId, query }
 */

import { NextRequest, NextResponse } from "next/server";
import { Orchestrator } from "@/lib/agents/orchestrator";

// Instancia global del orchestrator
const orchestrator = new Orchestrator();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.userId || !body.conversationId || !body.query) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, conversationId, query" },
        { status: 400 }
      );
    }

    const result = await orchestrator.processQuery(
      body.userId,
      body.conversationId,
      body.query
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error processing query" },
      { status: 500 }
    );
  }
}
