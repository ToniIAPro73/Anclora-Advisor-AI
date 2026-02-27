import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";
import { getRequestId, log } from "@/lib/observability/logger";
import { resolveLocale, t } from "@/lib/i18n/messages";

const invoicePayloadSchema = z.object({
  clientName: z.string().min(2).max(255),
  clientNif: z.string().min(5).max(50),
  amountBase: z.number().positive(),
  ivaRate: z.number().min(0).max(100),
  irpfRetention: z.number().min(0).max(100),
  issueDate: z.string().min(8),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, userId: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, userId: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, userId: user.id, error: null };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_invoices_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.missing_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    log("error", "api_invoices_get_failed", requestId, { error: error.message });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.db_error") }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, invoices: data ?? [] });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoices_get_succeeded", requestId, { count: (data ?? []).length });
  return response;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_invoices_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = invoicePayloadSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_invoices_payload_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.invalid_payload") }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const invoice = payload.data;
  const totalAmount = round2(invoice.amountBase + (invoice.amountBase * invoice.ivaRate) / 100 - (invoice.amountBase * invoice.irpfRetention) / 100);
  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: auth.userId,
      client_name: invoice.clientName,
      client_nif: invoice.clientNif,
      amount_base: round2(invoice.amountBase),
      iva_rate: round2(invoice.ivaRate),
      irpf_retention: round2(invoice.irpfRetention),
      total_amount: totalAmount,
      issue_date: invoice.issueDate,
      status: "draft",
    })
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .single();

  if (error) {
    log("error", "api_invoices_post_failed", requestId, { error: error.message });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.db_error") }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, invoice: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoices_post_succeeded", requestId, {
    invoiceId: data?.id ?? null,
    status: data?.status ?? null,
  });
  return response;
}
