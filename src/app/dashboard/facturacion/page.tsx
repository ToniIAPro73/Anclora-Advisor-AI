import { redirect } from "next/navigation";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";
import { InvoiceWorkspace, type InvoiceRecord } from "@/components/features/InvoiceWorkspace";

export default async function DashboardFacturacionPage() {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();
  if (!user || !accessToken) {
    redirect("/login");
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data } = await supabase
    .from("invoices")
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const invoices = (data ?? []) as InvoiceRecord[];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Facturacion</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Workspace operativo para generar facturas con IVA/IRPF, persistencia en Supabase y trazabilidad por estado.
        </p>
      </article>
      <InvoiceWorkspace initialInvoices={invoices} />
    </section>
  );
}
