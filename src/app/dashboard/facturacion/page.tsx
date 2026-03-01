import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuditLogRecord } from "@/lib/audit/logs";
import { InvoiceWorkspace } from "@/components/features/InvoiceWorkspace";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import type { InvoicePaymentRecord, InvoiceRecord } from "@/lib/invoices/contracts";
import { resolveLocale } from "@/lib/i18n/messages";
import { uiText } from "@/lib/i18n/ui";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

interface DashboardFacturacionPageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    invoiceType?: string;
    series?: string;
    dateFrom?: string;
    dateTo?: string;
    invoiceId?: string;
  }>;
}

export default async function DashboardFacturacionPage({ searchParams }: DashboardFacturacionPageProps) {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();
  if (!user || !accessToken) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("anclora.locale")?.value);
  const params = (await searchParams) ?? {};
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, series, invoice_number, recipient_email, sent_at, paid_at, payment_method, payment_reference, payment_notes, invoice_type, rectifies_invoice_id, rectification_reason, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const { data: auditData } = await supabase
    .from("app_audit_logs")
    .select("id, user_id, domain, entity_type, entity_id, action, summary, metadata, created_at")
    .eq("domain", "invoices")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: paymentData } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, amount, paid_at, payment_method, payment_reference, notes, created_at")
    .order("paid_at", { ascending: false })
    .limit(200);

  const invoices = (data ?? []) as InvoiceRecord[];
  const payments = (paymentData ?? []) as InvoicePaymentRecord[];
  const auditLogs = (auditData ?? []) as unknown as AuditLogRecord[];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl" style={{ color: "var(--text-primary)" }}>{uiText(locale, "page.invoice.title")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {uiText(locale, "page.invoice.subtitle")}
        </p>
      </article>
      <InvoiceWorkspace
        initialInvoices={invoices}
        initialAuditLogs={auditLogs}
        initialFilters={{
          q: params.q ?? "",
          series: params.series ?? "",
          dateFrom: params.dateFrom ?? "",
          dateTo: params.dateTo ?? "",
          invoiceType: params.invoiceType === "rectificative" ? "rectificative" : params.invoiceType === "standard" ? "standard" : "all",
          status:
            params.status === "draft" || params.status === "issued" || params.status === "paid"
              ? params.status
              : "all",
        }}
        initialSelectedInvoiceId={params.invoiceId ?? null}
        initialPayments={payments}
      />
    </section>
  );
}
