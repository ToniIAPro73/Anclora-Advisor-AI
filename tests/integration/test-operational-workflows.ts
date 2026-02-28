import { createFiscalAlertSchema, sortFiscalAlerts } from "../../src/lib/fiscal/alerts";
import { createFiscalTemplateSchema, getFiscalTemplateLabel } from "../../src/lib/fiscal/templates";
import { deliverInvoiceByEmail } from "../../src/lib/invoices/delivery";
import { renderInvoicePrintableHtml } from "../../src/lib/invoices/pdf";
import type { InvoiceRecord } from "../../src/lib/invoices/contracts";
import {
  createLaborMitigationActionSchema,
  createLaborRiskAssessmentSchema,
  deriveRiskLevel,
} from "../../src/lib/labor/assessments";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(`Integration assertion failed: ${label}`);
  }
  console.log(`OK  ${label}`);
}

function buildInvoiceFixture(): InvoiceRecord {
  return {
    id: "inv-1",
    client_name: "Cliente Demo SL",
    client_nif: "B12345678",
    amount_base: 1000,
    iva_rate: 21,
    irpf_retention: 15,
    total_amount: 1060,
    issue_date: "2026-02-28",
    status: "draft",
    series: "2026",
    invoice_number: 7,
    recipient_email: "cliente@demo.com",
    sent_at: null,
    created_at: "2026-02-28T10:00:00.000Z",
  };
}

async function main(): Promise<void> {
  console.log("=== Operational Integration Check ===");

  const invoice = buildInvoiceFixture();
  let sentMessage:
    | {
        to: string;
        subject: string;
        text: string;
        html?: string;
        attachments?: {
          filename: string;
          content: Buffer;
          contentType: string;
        }[];
      }
    | undefined;

  const delivery = await deliverInvoiceByEmail({
    invoice,
    recipientEmail: "facturas@demo.com",
    emailSender: {
      send: async (message) => {
        sentMessage = message;
        return { messageId: "smtp-message-1" };
      },
    },
  });

  assert(delivery.messageId === "smtp-message-1", "invoice delivery returns SMTP message id");
  assert(delivery.attachmentFilename === "factura-2026-0007.pdf", "invoice delivery builds deterministic PDF filename");
  assert(sentMessage?.to === "facturas@demo.com", "invoice delivery sends to requested recipient");
  assert(sentMessage?.subject.includes("Factura 2026-0007"), "invoice delivery subject includes invoice reference");
  assert(Boolean(sentMessage?.attachments?.[0]), "invoice delivery attaches a PDF");
  assert(sentMessage?.attachments?.[0]?.contentType === "application/pdf", "invoice delivery attachment content type is pdf");
  assert((sentMessage?.attachments?.[0]?.content.length ?? 0) > 500, "invoice delivery attachment contains binary payload");

  const printableHtml = renderInvoicePrintableHtml(invoice);
  assert(printableHtml.includes("Factura 2026-0007"), "printable HTML includes invoice reference");
  assert(printableHtml.includes("Cliente Demo SL"), "printable HTML includes client name");
  assert(printableHtml.includes("1060,00"), "printable HTML includes formatted total amount");

  const fiscalAlert = createFiscalAlertSchema.parse({
    alertType: "iva",
    description: "  Presentar IVA trimestral  ",
    dueDate: "2026-04-20",
    priority: "high",
  });
  assert(fiscalAlert.description === "Presentar IVA trimestral", "fiscal alert schema trims description");

  const sortedAlerts = sortFiscalAlerts([
    {
      id: "b",
      alert_type: "iva",
      description: null,
      due_date: "2026-04-20",
      priority: "high",
      status: "pending",
      created_at: "2026-03-01T12:00:00.000Z",
    },
    {
      id: "a",
      alert_type: "irpf",
      description: null,
      due_date: "2026-03-20",
      priority: "medium",
      status: "pending",
      created_at: "2026-03-01T09:00:00.000Z",
    },
  ]);
  assert(sortedAlerts[0]?.id === "a", "fiscal alerts are sorted by due date ascending");

  const fiscalTemplate = createFiscalTemplateSchema.parse({
    alertType: "iva",
    description: "  Preparar y revisar Modelo 303 trimestral  ",
    priority: "high",
    recurrence: "quarterly",
    dueDay: 20,
    startDate: "2026-01-01",
    isActive: true,
  });
  assert(fiscalTemplate.description === "Preparar y revisar Modelo 303 trimestral", "fiscal template schema trims description");
  assert(
    getFiscalTemplateLabel({
      alert_type: fiscalTemplate.alertType,
      recurrence: fiscalTemplate.recurrence,
      due_day: fiscalTemplate.dueDay,
      due_month: null,
    }).includes("trimestral"),
    "fiscal template label describes recurrence"
  );

  const laborAssessment = createLaborRiskAssessmentSchema.parse({
    scenarioDescription: "  Compatibilidad parcial con actividad por cuenta ajena y salida ordenada del empleo. ",
    riskScore: 0.62,
    riskLevel: "high",
    recommendations: [" Revisar clausulas ", "Planificar salida  ", ""],
  });
  assert(laborAssessment.scenarioDescription.startsWith("Compatibilidad"), "labor assessment schema trims description");
  assert(laborAssessment.recommendations?.length === 2, "labor assessment schema normalizes recommendations");
  assert(deriveRiskLevel(0.62) === "high", "labor risk level is derived from score when needed");

  const laborAction = createLaborMitigationActionSchema.parse({
    title: "  Revisar pacto de exclusividad  ",
    description: "  Validar clausulas antes de comunicar la transicion. ",
    dueDate: "2026-03-15",
  });
  assert(laborAction.title === "Revisar pacto de exclusividad", "labor action schema trims title");
  assert(laborAction.status === "pending", "labor action schema defaults to pending status");

  console.log("Operational integration status: PASS");
}

main().catch((error) => {
  console.error("Operational integration status: FAIL");
  console.error(error);
  process.exit(1);
});
