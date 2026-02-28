import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { renderInvoicePrintableHtml } from "@/lib/invoices/pdf";
import { INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

async function getAuthenticatedAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return null;
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return null;
  }

  return accessToken;
}

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const accessToken = await getAuthenticatedAccessToken();

  if (!accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (error || !data) {
    log("error", "api_invoice_pdf_failed", requestId, { invoiceId, error: error?.message ?? "not_found" });
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const invoiceRecord = data as unknown as InvoiceRecord;
  const html = renderInvoicePrintableHtml(invoiceRecord);

  const response = new NextResponse(html, { status: 200 });
  response.headers.set("content-type", "text/html; charset=utf-8");
  response.headers.set("x-request-id", requestId);
  return response;
}
