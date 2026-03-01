import { buildSuggestedChatActions } from "../../src/lib/chat/action-suggestions";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const fiscalActions = buildSuggestedChatActions({
    query: "Cuando puedo solicitar la cuota cero de autonomos y cual es el plazo?",
    response: "Puedes revisarlo segun tu comunidad autonoma.",
    routing: { primarySpecialist: "fiscal", confidence: 0.9 },
    alerts: [],
  });
  assert(
    fiscalActions.some((action) => action.kind === "create_fiscal_alert"),
    "expected fiscal alert suggestion",
  );

  const fiscalExistingActions = buildSuggestedChatActions({
    query: "Que alertas fiscales pendientes tengo sobre cuota cero e IVA?",
    response: "Revisa tus alertas actuales antes de abrir nuevas obligaciones.",
    routing: { primarySpecialist: "fiscal", confidence: 0.9 },
    alerts: [],
  });
  assert(
    fiscalExistingActions.some((action) => action.kind === "open_existing_fiscal_alert"),
    "expected open fiscal alert suggestion",
  );

  const laborActions = buildSuggestedChatActions({
    query: "Que riesgos de pluriactividad y conflicto contractual asumo si sigo en mi empresa?",
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

  const laborExistingActions = buildSuggestedChatActions({
    query: "Que mitigaciones laborales tengo abiertas y que seguimiento llevan?",
    response: "Conviene revisar las acciones ya registradas.",
    routing: { primarySpecialist: "labor", confidence: 0.9 },
    alerts: [],
  });
  assert(
    laborExistingActions.some((action) => action.kind === "open_existing_labor_assessment"),
    "expected open labor assessment suggestion",
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

  const existingInvoiceActions = buildSuggestedChatActions({
    query: "Que facturas emitidas tengo para el cliente Demo este mes?",
    response: "Abre facturacion y revisa las emitidas del cliente.",
    routing: { primarySpecialist: "fiscal", confidence: 0.7 },
    alerts: [],
  });
  assert(
    existingInvoiceActions.some((action) => action.kind === "open_existing_invoice"),
    "expected open invoice suggestion",
  );

  console.log("Chat action suggestions: PASS");
}

main();
