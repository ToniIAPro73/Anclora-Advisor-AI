import { NextRequest } from "next/server";
import { Orchestrator } from "../../../../../lib/agents/orchestrator";
import { addRagTrace } from "@/lib/observability/rag-traces";
import { getRequestId, log } from "@/lib/observability/logger";
import { resolveLocale, t } from "@/lib/i18n/messages";

const orchestrator = new Orchestrator();

function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function chunkText(text: string, chunkSize = 140): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));

  let body: { userId?: string; conversationId?: string; query?: string };
  try {
    body = (await request.json()) as { userId?: string; conversationId?: string; query?: string };
  } catch {
    return new Response(
      encodeSse("error", { error: t(locale, "api.chat.processing_error") }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "x-request-id": requestId,
        },
      }
    );
  }

  if (!body.userId || !body.conversationId || !body.query) {
    return new Response(
      encodeSse("error", { error: t(locale, "api.chat.missing_fields") }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "x-request-id": requestId,
        },
      }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const run = async () => {
        const enqueue = (event: string, data: unknown) =>
          controller.enqueue(new TextEncoder().encode(encodeSse(event, data)));
        try {
          enqueue("status", { phase: "processing" });
          log("info", "api_chat_stream_started", requestId, {
            userId: body.userId,
            conversationId: body.conversationId,
            queryLength: String(body.query).length,
          });

          const result = await orchestrator.processQuery(body.userId!, body.conversationId!, body.query!);

          addRagTrace({
            requestId,
            timestamp: new Date().toISOString(),
            success: true,
            queryLength: String(body.query).length,
            userId: String(body.userId),
            conversationId: String(body.conversationId),
            primarySpecialist: result.routing?.primarySpecialist ?? null,
            groundingConfidence: result.groundingConfidence,
            citations: Array.isArray(result.citations) ? result.citations.length : 0,
            alerts: Array.isArray(result.alerts) ? result.alerts.length : 0,
            error: null,
            performance: result.performance,
          });

          for (const delta of chunkText(result.primarySpecialistResponse)) {
            enqueue("chunk", { delta });
          }

          enqueue("complete", {
              success: true,
              primarySpecialistResponse: result.primarySpecialistResponse,
              routing: result.routing,
              citations: result.citations,
              contexts: result.contexts,
              alerts: result.alerts,
              groundingConfidence: result.groundingConfidence,
              performance: result.performance,
            });
          log("info", "api_chat_stream_succeeded", requestId, {
            citations: Array.isArray(result.citations) ? result.citations.length : 0,
            groundingConfidence: result.groundingConfidence,
            perf: result.performance,
          });
        } catch (error) {
          addRagTrace({
            requestId,
            timestamp: new Date().toISOString(),
            success: false,
            queryLength: String(body.query).length,
            userId: String(body.userId),
            conversationId: String(body.conversationId),
            primarySpecialist: null,
            groundingConfidence: null,
            citations: 0,
            alerts: 0,
            error: error instanceof Error ? error.message : "unknown_error",
            performance: null,
          });
          log("error", "api_chat_stream_failed", requestId, {
            error: error instanceof Error ? error.message : "unknown_error",
          });
          enqueue("error", {
              error: error instanceof Error ? error.message : t(locale, "api.chat.processing_error"),
            });
        } finally {
          controller.close();
        }
      };

      void run();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": requestId,
    },
  });
}
