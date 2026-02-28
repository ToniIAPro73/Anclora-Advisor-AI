import * as chatRoute from "../src/app/api/chat/route";
import * as adminIngestRoute from "../src/app/api/admin/rag/ingest/route";
import * as adminStatusRoute from "../src/app/api/admin/rag/status/route";
import * as invoicesRoute from "../src/app/api/invoices/route";
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
  assert(typeof adminIngestRoute.POST === "function", "POST /api/admin/rag/ingest handler exported");
  assert(typeof adminStatusRoute.GET === "function", "GET /api/admin/rag/status handler exported");
  assert(typeof invoicesRoute.GET === "function", "GET /api/invoices handler exported");
  assert(typeof invoicesRoute.POST === "function", "POST /api/invoices handler exported");

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
