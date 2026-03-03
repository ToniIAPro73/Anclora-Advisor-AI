import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import {
  buildInvoiceImportStoragePath,
  getInvoiceImportSource,
  INVOICE_IMPORTS_BUCKET,
  parseInvoiceDocument,
} from "@/lib/invoices/imports";
import { calculateInvoiceTotals } from "@/lib/tools/invoice-calculator";
import {
  getNextInvoiceNumber,
  INVOICE_SELECT_FIELDS,
  normalizeInvoiceSeries,
} from "@/lib/invoices/service";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";
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

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.invalid_session") }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const response = NextResponse.json({ success: false, error: "INVOICE_FILE_REQUIRED" }, { status: 400 });
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseInvoiceDocument({
      buffer,
      fileName: file.name,
      mimeType: file.type,
    });
    const calculation = calculateInvoiceTotals({
      amountBase: parsed.amountBase,
      ivaRate: parsed.ivaRate,
      irpfRetention: parsed.irpfRetention,
    });
    const series = normalizeInvoiceSeries(parsed.series, parsed.issueDate);

    const userScoped = createUserScopedSupabaseClient(auth.accessToken);
    const invoiceNumber = await getNextInvoiceNumber(userScoped, auth.userId, series);

    const storagePath = buildInvoiceImportStoragePath(auth.userId, file.name);
    const admin = createServiceSupabaseClient();
    const { error: uploadError } = await admin.storage.from(INVOICE_IMPORTS_BUCKET).upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await userScoped
      .from("invoices")
      .insert({
        user_id: auth.userId,
        client_name: parsed.clientName,
        client_nif: parsed.clientNif,
        amount_base: calculation.amountBase,
        iva_rate: calculation.ivaRate,
        irpf_retention: calculation.irpfRetention,
        total_amount: calculation.totalAmount,
        issue_date: parsed.issueDate,
        status: "issued",
        series,
        invoice_number: invoiceNumber,
        recipient_email: parsed.recipientEmail ?? null,
        invoice_type: "standard",
        verifactu_status: "not_sent",
        import_source: getInvoiceImportSource(parsed.importKind),
        import_file_name: file.name,
        import_storage_path: storagePath,
        import_confidence: parsed.confidence,
        imported_at: new Date().toISOString(),
      })
      .select(INVOICE_SELECT_FIELDS)
      .single();

    if (error || !data) {
      await admin.storage.from(INVOICE_IMPORTS_BUCKET).remove([storagePath]);
      throw new Error(error?.message ?? "INVOICE_IMPORT_INSERT_FAILED");
    }

    const invoice = data as unknown as InvoiceRecord;
    try {
      await createAuditLog(admin, {
        userId: auth.userId,
        domain: "invoices",
        entityType: "invoice_import",
        entityId: invoice.id,
        action: "created",
        summary: `Factura importada desde documento: ${file.name}`,
        metadata: {
          fileName: file.name,
          storagePath,
          confidence: parsed.confidence,
          engine: parsed.engine,
          importKind: parsed.importKind,
          warnings: parsed.warnings,
        },
      });
    } catch {
      // Import should not fail because of audit logging.
    }

    const response = NextResponse.json({
      success: true,
      invoice,
      import: {
        fileName: file.name,
        storagePath,
        confidence: parsed.confidence,
        engine: parsed.engine,
        importKind: parsed.importKind,
        warnings: parsed.warnings,
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVOICE_IMPORT_FAILED";
    log("error", "api_invoice_import_pdf_failed", requestId, {
      userId: auth.userId,
      error: message,
    });
    const status =
      message === "INVOICE_FILE_REQUIRED" ||
      message === "INVOICE_IMPORT_UNSUPPORTED_FILE" ||
      message === "PDF_IMPORT_PARSE_FAILED" ||
      message === "PDF_TEXT_EXTRACTION_FAILED" ||
      message === "VLM_IMPORT_PARSE_FAILED" ||
      message === "VLM_IMPORT_NOT_ENABLED" ||
      message === "PDF_TO_IMAGE_CONVERSION_FAILED"
        ? 400
        : 500;
    const response = NextResponse.json({ success: false, error: message }, { status });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
