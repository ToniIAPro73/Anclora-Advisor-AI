import * as chatRoute from "../src/app/api/chat/route";
import * as chatConversationsRoute from "../src/app/api/chat/conversations/route";
import * as chatConversationDetailRoute from "../src/app/api/chat/conversations/[conversationId]/route";
import * as adminIngestRoute from "../src/app/api/admin/rag/ingest/route";
import * as adminDocumentDeleteRoute from "../src/app/api/admin/rag/documents/[documentId]/route";
import * as adminObservabilityRagRoute from "../src/app/api/admin/observability/rag/route";
import * as adminStatusRoute from "../src/app/api/admin/rag/status/route";
import * as chatStreamRoute from "../src/app/api/chat/stream/route";
import * as fiscalAlertsRoute from "../src/app/api/fiscal-alerts/route";
import * as fiscalAlertDetailRoute from "../src/app/api/fiscal-alerts/[alertId]/route";
import * as fiscalTemplatesRoute from "../src/app/api/fiscal-templates/route";
import * as fiscalTemplateDetailRoute from "../src/app/api/fiscal-templates/[templateId]/route";
import * as fiscalTemplateGenerateRoute from "../src/app/api/fiscal-templates/generate/route";
import * as laborAssessmentsRoute from "../src/app/api/labor-risk-assessments/route";
import * as laborAssessmentDetailRoute from "../src/app/api/labor-risk-assessments/[assessmentId]/route";
import * as laborAssessmentActionsRoute from "../src/app/api/labor-risk-assessments/[assessmentId]/actions/route";
import * as laborMitigationActionDetailRoute from "../src/app/api/labor-mitigation-actions/[actionId]/route";
import * as invoicesRoute from "../src/app/api/invoices/route";
import * as invoiceDetailRoute from "../src/app/api/invoices/[invoiceId]/route";
import * as invoicePdfRoute from "../src/app/api/invoices/[invoiceId]/pdf/route";
import * as invoiceSendRoute from "../src/app/api/invoices/[invoiceId]/send/route";
import * as internalJobsProcessRoute from "../src/app/api/internal/jobs/process/route";
import * as operationsJobsRoute from "../src/app/api/operations/jobs/route";
import { AdminKnowledgeWorkspace } from "../src/components/features/AdminKnowledgeWorkspace";
import { ChatInterface } from "../src/components/features/ChatInterface";
import { FiscalWorkspace } from "../src/components/features/FiscalWorkspace";
import { InvoiceWorkspace } from "../src/components/features/InvoiceWorkspace";
import { LaborWorkspace } from "../src/components/features/LaborWorkspace";
import { buildProactiveFiscalAlerts } from "../src/lib/alerts/proactive-alerts";
import dashboardLayout from "../src/app/dashboard/layout";
import dashboardAdminPage from "../src/app/dashboard/admin/page";
import dashboardChatPage from "../src/app/dashboard/chat/page";
import dashboardFiscalPage from "../src/app/dashboard/fiscal/page";
import dashboardLaboralPage from "../src/app/dashboard/laboral/page";
import dashboardFacturacionPage from "../src/app/dashboard/facturacion/page";
import loginPage from "../src/app/login/page";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(`Smoke assertion failed: ${label}`);
  }
  console.log(`OK  ${label}`);
}

async function main(): Promise<void> {
  console.log("=== Smoke Hardening Check ===");

  assert(typeof chatRoute.POST === "function", "POST /api/chat handler exported");
  assert(typeof chatStreamRoute.POST === "function", "POST /api/chat/stream handler exported");
  assert(typeof chatConversationsRoute.GET === "function", "GET /api/chat/conversations handler exported");
  assert(typeof chatConversationsRoute.POST === "function", "POST /api/chat/conversations handler exported");
  assert(typeof chatConversationDetailRoute.GET === "function", "GET /api/chat/conversations/[conversationId] handler exported");
  assert(typeof chatConversationDetailRoute.PATCH === "function", "PATCH /api/chat/conversations/[conversationId] handler exported");
  assert(typeof adminIngestRoute.POST === "function", "POST /api/admin/rag/ingest handler exported");
  assert(typeof adminDocumentDeleteRoute.DELETE === "function", "DELETE /api/admin/rag/documents/[documentId] handler exported");
  assert(typeof adminObservabilityRagRoute.GET === "function", "GET /api/admin/observability/rag handler exported");
  assert(typeof adminStatusRoute.GET === "function", "GET /api/admin/rag/status handler exported");
  assert(typeof fiscalAlertsRoute.GET === "function", "GET /api/fiscal-alerts handler exported");
  assert(typeof fiscalAlertsRoute.POST === "function", "POST /api/fiscal-alerts handler exported");
  assert(typeof fiscalAlertDetailRoute.PATCH === "function", "PATCH /api/fiscal-alerts/[alertId] handler exported");
  assert(typeof fiscalAlertDetailRoute.DELETE === "function", "DELETE /api/fiscal-alerts/[alertId] handler exported");
  assert(typeof fiscalTemplatesRoute.GET === "function", "GET /api/fiscal-templates handler exported");
  assert(typeof fiscalTemplatesRoute.POST === "function", "POST /api/fiscal-templates handler exported");
  assert(typeof fiscalTemplateDetailRoute.PATCH === "function", "PATCH /api/fiscal-templates/[templateId] handler exported");
  assert(typeof fiscalTemplateDetailRoute.DELETE === "function", "DELETE /api/fiscal-templates/[templateId] handler exported");
  assert(typeof fiscalTemplateGenerateRoute.POST === "function", "POST /api/fiscal-templates/generate handler exported");
  assert(typeof laborAssessmentsRoute.GET === "function", "GET /api/labor-risk-assessments handler exported");
  assert(typeof laborAssessmentsRoute.POST === "function", "POST /api/labor-risk-assessments handler exported");
  assert(typeof laborAssessmentDetailRoute.PATCH === "function", "PATCH /api/labor-risk-assessments/[assessmentId] handler exported");
  assert(typeof laborAssessmentDetailRoute.DELETE === "function", "DELETE /api/labor-risk-assessments/[assessmentId] handler exported");
  assert(typeof laborAssessmentActionsRoute.POST === "function", "POST /api/labor-risk-assessments/[assessmentId]/actions handler exported");
  assert(typeof laborMitigationActionDetailRoute.PATCH === "function", "PATCH /api/labor-mitigation-actions/[actionId] handler exported");
  assert(typeof laborMitigationActionDetailRoute.DELETE === "function", "DELETE /api/labor-mitigation-actions/[actionId] handler exported");
  assert(typeof invoicesRoute.GET === "function", "GET /api/invoices handler exported");
  assert(typeof invoicesRoute.POST === "function", "POST /api/invoices handler exported");
  assert(typeof invoiceDetailRoute.PATCH === "function", "PATCH /api/invoices/[invoiceId] handler exported");
  assert(typeof invoiceDetailRoute.DELETE === "function", "DELETE /api/invoices/[invoiceId] handler exported");
  assert(typeof invoicePdfRoute.GET === "function", "GET /api/invoices/[invoiceId]/pdf handler exported");
  assert(typeof invoiceSendRoute.POST === "function", "POST /api/invoices/[invoiceId]/send handler exported");
  assert(typeof internalJobsProcessRoute.POST === "function", "POST /api/internal/jobs/process handler exported");
  assert(typeof operationsJobsRoute.GET === "function", "GET /api/operations/jobs handler exported");
  assert(typeof operationsJobsRoute.POST === "function", "POST /api/operations/jobs handler exported");

  assert(typeof AdminKnowledgeWorkspace === "function", "admin knowledge workspace exported");
  assert(typeof ChatInterface === "function", "chat interface exported");
  assert(typeof FiscalWorkspace === "function", "fiscal workspace exported");
  assert(typeof InvoiceWorkspace === "function", "invoice workspace exported");
  assert(typeof LaborWorkspace === "function", "labor workspace exported");
  assert(typeof buildProactiveFiscalAlerts === "function", "proactive fiscal alerts helper exported");
  assert(typeof dashboardLayout === "function", "dashboard layout component exported");
  assert(typeof dashboardAdminPage === "function", "dashboard admin page exported");
  assert(typeof dashboardChatPage === "function", "dashboard chat page exported");
  assert(typeof dashboardFiscalPage === "function", "dashboard fiscal page exported");
  assert(typeof dashboardLaboralPage === "function", "dashboard laboral page exported");
  assert(typeof dashboardFacturacionPage === "function", "dashboard facturacion page exported");
  assert(typeof loginPage === "function", "login page exported");

  console.log("Smoke status: PASS");
}

main().catch((error) => {
  console.error("Smoke status: FAIL");
  console.error(error);
  process.exit(1);
});

