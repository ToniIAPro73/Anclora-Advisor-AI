import type { ChatSuggestedAction } from "@/lib/chat/action-suggestions";

type FiscalAlertLookupRecord = {
  id: string;
  alert_type: string;
  description: string | null;
  period_key: string | null;
};

type LaborAssessmentLookupRecord = {
  id: string;
  scenario_description: string;
  recommendations: string[] | null;
};

type InvoiceLookupRecord = {
  id: string;
  client_name: string;
  client_nif: string;
  series: string | null;
  invoice_number: number | null;
};

function scoreTextMatch(searchQuery: string, values: Array<string | null | undefined>): number {
  const normalizedNeedle = searchQuery.trim().toLowerCase();
  if (!normalizedNeedle) return 0;

  const tokens = normalizedNeedle.split(/\s+/).filter((token) => token.length >= 3);
  const haystack = values.filter(Boolean).join(" ").toLowerCase();

  if (!haystack) return 0;

  let score = 0;
  if (haystack.includes(normalizedNeedle)) {
    score += 10;
  }
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 2;
    }
  }
  return score;
}

export async function resolveExactNavigationHref(action: ChatSuggestedAction): Promise<string> {
  if (
    action.kind !== "open_existing_fiscal_alert" &&
    action.kind !== "open_existing_labor_assessment" &&
    action.kind !== "open_existing_invoice"
  ) {
    return action.navigationHref;
  }

  const searchQuery = "searchQuery" in action.payload ? action.payload.searchQuery : "";
  if (!searchQuery.trim()) {
    return action.navigationHref;
  }

  try {
    if (action.kind === "open_existing_fiscal_alert") {
      const response = await fetch("/api/fiscal-alerts", { cache: "no-store" });
      const result = (await response.json()) as { success?: boolean; alerts?: FiscalAlertLookupRecord[] };
      if (!response.ok || !result.success || !result.alerts) {
        return action.navigationHref;
      }

      const best = result.alerts
        .map((alert) => ({
          alert,
          score: scoreTextMatch(searchQuery, [alert.alert_type, alert.description, alert.period_key]),
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)[0];

      if (!best) {
        return action.navigationHref;
      }

      const next = new URL(action.navigationHref, window.location.origin);
      next.searchParams.set("alertId", best.alert.id);
      return `${next.pathname}?${next.searchParams.toString()}`;
    }

    if (action.kind === "open_existing_labor_assessment") {
      const response = await fetch("/api/labor-risk-assessments", { cache: "no-store" });
      const result = (await response.json()) as { success?: boolean; assessments?: LaborAssessmentLookupRecord[] };
      if (!response.ok || !result.success || !result.assessments) {
        return action.navigationHref;
      }

      const best = result.assessments
        .map((assessment) => ({
          assessment,
          score: scoreTextMatch(searchQuery, [
            assessment.scenario_description,
            ...(assessment.recommendations ?? []),
          ]),
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)[0];

      if (!best) {
        return action.navigationHref;
      }

      const next = new URL(action.navigationHref, window.location.origin);
      next.searchParams.set("assessmentId", best.assessment.id);
      return `${next.pathname}?${next.searchParams.toString()}`;
    }

    const response = await fetch(action.navigationHref.startsWith("/dashboard/facturacion") ? `/api/invoices?q=${encodeURIComponent(searchQuery)}&limit=25` : "/api/invoices?limit=25", {
      cache: "no-store",
    });
    const result = (await response.json()) as { success?: boolean; invoices?: InvoiceLookupRecord[] };
    if (!response.ok || !result.success || !result.invoices) {
      return action.navigationHref;
    }

    const best = result.invoices
      .map((invoice) => ({
        invoice,
        score: scoreTextMatch(searchQuery, [
          invoice.client_name,
          invoice.client_nif,
          invoice.series,
          invoice.invoice_number ? String(invoice.invoice_number) : "",
        ]),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    if (!best) {
      return action.navigationHref;
    }

    const next = new URL(action.navigationHref, window.location.origin);
    next.searchParams.set("invoiceId", best.invoice.id);
    return `${next.pathname}?${next.searchParams.toString()}`;
  } catch {
    return action.navigationHref;
  }
}
