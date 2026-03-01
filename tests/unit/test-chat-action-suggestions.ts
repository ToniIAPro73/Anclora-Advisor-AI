import { buildSuggestedChatActions } from "../../src/lib/chat/action-suggestions";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const fiscalActions = buildSuggestedChatActions({
    query: "Cuando puedo solicitar la cuota cero de autonomos y que plazo tengo?",
    response: "Puedes revisarlo segun tu comunidad autonoma.",
    routing: { primarySpecialist: "fiscal", confidence: 0.9 },
    alerts: [],
  });
  assert(
    fiscalActions.some((action) => action.kind === "create_fiscal_alert"),
    "expected fiscal alert suggestion",
  );

  const laborActions = buildSuggestedChatActions({
    query: "Que riesgos de pluriactividad y conflicto contractual tengo si sigo en mi empresa?",
    response: "Hay riesgo laboral y reputacional.",
    routing: { primarySpecialist: "labor", confidence: 0.9 },
    alerts: [{ type: "HIGH", message: "riesgo alto" }],
  });
  const laborAction = laborActions.find((action) => action.kind === "create_labor_assessment");
  assert(Boolean(laborAction), "expected labor assessment suggestion");
  assert(
    laborAction?.kind === "create_labor_assessment" && laborAction.payload.riskScore >= 0.78,
    "expected elevated labor risk score",
  );

  const invoiceActions = buildSuggestedChatActions({
    query: "Calcula una factura con base 1000, IVA 21 e IRPF 15",
    response: "Base 1000, IVA 210, IRPF 150.",
    routing: { primarySpecialist: "fiscal", confidence: 0.95 },
    alerts: [],
  });
  const invoiceAction = invoiceActions.find((action) => action.kind === "create_invoice_draft");
  assert(Boolean(invoiceAction), "expected invoice draft suggestion");
  assert(
    invoiceAction?.kind === "create_invoice_draft" &&
      invoiceAction.payload.amountBase === 1000 &&
      invoiceAction.payload.ivaRate === 21 &&
      invoiceAction.payload.irpfRetention === 15,
    "expected parsed invoice payload",
  );

  console.log("Chat action suggestions: PASS");
}

main();
