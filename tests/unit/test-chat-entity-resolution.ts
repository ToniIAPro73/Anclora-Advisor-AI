import { resolveExactNavigationHref } from "../../src/lib/chat/entity-resolution";
import type { ChatSuggestedAction } from "../../src/lib/chat/action-suggestions";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const originalFetch = global.fetch;
  const originalWindow = global.window;

  const fakeFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/fiscal-alerts")) {
      return new Response(
        JSON.stringify({
          success: true,
          alerts: [{ id: "alert-1", alert_type: "iva", description: "Seguimiento cuota cero", period_key: "2026Q1" }],
        }),
        { status: 200 }
      );
    }
    if (url.startsWith("/api/labor-risk-assessments")) {
      return new Response(
        JSON.stringify({
          success: true,
          assessments: [{ id: "assessment-1", scenario_description: "Pluriactividad con empresa actual", recommendations: ["revisar clausulas"] }],
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        invoices: [{ id: "invoice-1", client_name: "Cliente Demo", client_nif: "B12345678", series: "2026", invoice_number: 7 }],
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  Object.assign(global, {
    fetch: fakeFetch,
    window: { location: { origin: "http://localhost:3000" } },
  });

  const fiscalAction: ChatSuggestedAction = {
    id: "a1",
    kind: "open_existing_fiscal_alert",
    title: "",
    description: "",
    ctaLabel: "",
    navigationHref: "/dashboard/fiscal?q=cuota%20cero",
    payload: { searchQuery: "cuota cero" },
  };
  const laborAction: ChatSuggestedAction = {
    id: "a2",
    kind: "open_existing_labor_assessment",
    title: "",
    description: "",
    ctaLabel: "",
    navigationHref: "/dashboard/laboral?scenario=pluriactividad",
    payload: { searchQuery: "pluriactividad" },
  };
  const invoiceAction: ChatSuggestedAction = {
    id: "a3",
    kind: "open_existing_invoice",
    title: "",
    description: "",
    ctaLabel: "",
    navigationHref: "/dashboard/facturacion?q=cliente",
    payload: { searchQuery: "cliente" },
  };

  const fiscalHref = await resolveExactNavigationHref(fiscalAction);
  const laborHref = await resolveExactNavigationHref(laborAction);
  const invoiceHref = await resolveExactNavigationHref(invoiceAction);

  assert(fiscalHref.includes("alertId=alert-1"), "expected fiscal deep-link");
  assert(laborHref.includes("assessmentId=assessment-1"), "expected labor deep-link");
  assert(invoiceHref.includes("invoiceId=invoice-1"), "expected invoice deep-link");

  Object.assign(global, { fetch: originalFetch, window: originalWindow });
  console.log("Chat entity resolution: PASS");
}

main().catch((error) => {
  console.error("Chat entity resolution: FAIL");
  console.error(error);
  process.exit(1);
});
