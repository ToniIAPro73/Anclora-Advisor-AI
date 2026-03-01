import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { invoiceStatusValues, type InvoiceRecord } from "@/lib/invoices/contracts";
import {
  applyInvoiceFilters,
  buildInvoiceCsv,
  buildInvoiceReference,
  INVOICE_SELECT_FIELDS,
  normalizeInvoiceQueryParams,
} from "@/lib/invoices/service";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

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
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format")?.trim().toLowerCase() ?? "csv";
  const filters = normalizeInvoiceQueryParams({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    invoiceType: searchParams.get("invoiceType") ?? undefined,
    series: searchParams.get("series") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: Number.parseInt(searchParams.get("limit") ?? "500", 10) || 500,
  });

  try {
    const supabase = createUserScopedSupabaseClient(auth.accessToken);
    const query = applyInvoiceFilters(
      supabase.from("invoices").select(INVOICE_SELECT_FIELDS).order("issue_date", { ascending: false }).limit(filters.limit),
      filters,
      invoiceStatusValues
    );
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const invoices = (data ?? []) as unknown as InvoiceRecord[];
    const exportRows = invoices.map((invoice) => ({
      reference: buildInvoiceReference(invoice.series, invoice.invoice_number),
      clientName: invoice.client_name,
      clientNif: invoice.client_nif,
      issueDate: invoice.issue_date,
      status: invoice.status,
      series: invoice.series ?? "",
      amountBase: Number(invoice.amount_base),
      ivaRate: Number(invoice.iva_rate),
      irpfRetention: Number(invoice.irpf_retention),
      totalAmount: Number(invoice.total_amount),
      recipientEmail: invoice.recipient_email ?? "",
    }));

    if (format === "json") {
      return NextResponse.json({ success: true, invoices: exportRows });
    }

    const body = buildInvoiceCsv(exportRows);
    const response = new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="invoices-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    log("error", "api_invoices_export_failed", requestId, {
      userId: auth.userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "EXPORT_FAILED" }, { status: 500 });
  }
}
