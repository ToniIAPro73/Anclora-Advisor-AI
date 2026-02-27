// src/app/api/chat/route.ts
/**
 * API ENDPOINT: Procesa queries multi-especialista
 * * POST /api/chat
 * Body: { userId, conversationId, query }
 */

import { NextRequest, NextResponse } from "next/server";
import { Orchestrator } from "../../../../lib/agents/orchestrator";
import { getRequestId, log } from "@/lib/observability/logger";
import { resolveLocale, t } from "@/lib/i18n/messages";

// Instancia global del orchestrator
const orchestrator = new Orchestrator();

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));

  try {
    const body = await request.json();

    if (!body.userId || !body.conversationId || !body.query) {
      log("warn", "api_chat_validation_failed", requestId, {
        hasUserId: !!body.userId,
        hasConversationId: !!body.conversationId,
        hasQuery: !!body.query,
      });
      const response = NextResponse.json(
        { success: false, error: t(locale, "api.chat.missing_fields") },
        { status: 400 }
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    log("info", "api_chat_request_started", requestId, {
      userId: body.userId,
      conversationId: body.conversationId,
      queryLength: String(body.query).length,
    });

    const result = await orchestrator.processQuery(
      body.userId,
      body.conversationId,
      body.query
    );

    const response = NextResponse.json(result);
    response.headers.set("x-request-id", requestId);
    log("info", "api_chat_request_succeeded", requestId, {
      citations: Array.isArray(result.citations) ? result.citations.length : 0,
      groundingConfidence: result.groundingConfidence,
    });
    return response;
  } catch (error) {
    log("error", "api_chat_request_failed", requestId, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    const response = NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : t(locale, "api.chat.processing_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
