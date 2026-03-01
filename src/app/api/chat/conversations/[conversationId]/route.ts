import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

const updateConversationSchema = z.object({
  title: z.string().min(1).max(500).transform((value) => value.trim()),
});

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, error: null };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_chat_conversation_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { conversationId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", conversationId)
    .single();

  if (conversationError || !conversation) {
    log("warn", "api_chat_conversation_not_found", requestId, { conversationId, error: conversationError?.message ?? null });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.conversation_not_found") },
      { status: 404 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, role, content, created_at, context_chunks, suggested_actions")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    log("error", "api_chat_conversation_messages_failed", requestId, { conversationId, error: messagesError.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, conversation, messages: messages ?? [] });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateConversationSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { conversationId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("conversations")
    .update({ title: payload.data.title })
    .eq("id", conversationId)
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    log("error", "api_chat_conversation_patch_failed", requestId, { conversationId, error: error?.message ?? "unknown" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.chat.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, conversation: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
