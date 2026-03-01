import { redirect } from "next/navigation";
import type { AuditLogRecord } from "@/lib/audit/logs";
import { InvoiceWorkspace } from "@/components/features/InvoiceWorkspace";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

interface DashboardFacturacionPageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    series?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function DashboardFacturacionPage({ searchParams }: DashboardFacturacionPageProps) {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();
  if (!user || !accessToken) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, series, invoice_number, recipient_email, sent_at, paid_at, payment_method, payment_reference, payment_notes, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const { data: auditData } = await supabase
    .from("app_audit_logs")
    .select("id, user_id, domain, entity_type, entity_id, action, summary, metadata, created_at")
    .eq("domain", "invoices")
    .order("created_at", { ascending: false })
    .limit(8);

  const invoices = (data ?? []) as InvoiceRecord[];
  const auditLogs = (auditData ?? []) as unknown as AuditLogRecord[];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Facturacion</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Workspace operativo para alta, edicion, numeracion por serie, vista imprimible y envio asistido.
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
          status:
            params.status === "draft" || params.status === "issued" || params.status === "paid"
              ? params.status
              : "all",
        }}
      />
    </section>
  );
}
