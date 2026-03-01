import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getSupabaseAnonKey, getSupabaseUrl } from "../../src/lib/env";
import { createServiceSupabaseClient } from "../../src/lib/supabase/server-admin";

let tempUserId: string | null = null;
const tempEmail = `playwright_${Date.now()}@anclora.local`;
const tempPassword = `Pw-${Date.now()}-UI!`;
const evidenceFixturePath = "tests/fixtures/labor-evidence.txt";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(tempEmail);
  await page.locator("#password").fill(tempPassword);
  await page.getByRole("button", { name: "Entrar al dashboard" }).click();
  await page.waitForURL("**/dashboard/chat");
  await expect(page.getByRole("heading", { name: "Workspace Conversacional", exact: true })).toBeVisible();
}

async function navigateFromSidebar(page: Page, linkName: RegExp, heading: string): Promise<void> {
  const sidebar = page.locator("aside");
  await sidebar.getByRole("link", { name: linkName }).click();
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  const admin = createServiceSupabaseClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create Playwright test user");
  }

  tempUserId = data.user.id;

  const anon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await anon.auth.signOut();
});

test.afterAll(async () => {
  if (!tempUserId) {
    return;
  }
  const admin = createServiceSupabaseClient();
  await admin.auth.admin.deleteUser(tempUserId);
});

test("login flow and dashboard navigation create a real invoice", async ({ page }) => {
  await login(page);
  await navigateFromSidebar(page, /Facturacion/i, "Facturacion");

  const clientName = `Cliente UI ${Date.now()}`;
  await page.getByLabel("Cliente").fill(clientName);
  await page.getByLabel("NIF/CIF").fill("B12345678");
  await page.getByLabel("Serie").fill("PWUI");
  await page.getByLabel("Email destinatario").fill("cliente.ui@example.com");
  await page.getByRole("button", { name: "Guardar borrador" }).click();

  await expect(page.getByText("Factura guardada en borrador.")).toBeVisible();
  await expect(page.getByText(clientName, { exact: true })).toBeVisible();

  await page.getByPlaceholder("Cliente o NIF").fill(clientName);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText(clientName, { exact: true })).toBeVisible();

  const invoiceCard = page.locator("div").filter({ has: page.getByText(clientName, { exact: true }) }).first();
  await invoiceCard.getByRole("button", { name: "Emitir" }).click();
  await expect(page.getByText("Factura marcada como issued.")).toBeVisible();

  await invoiceCard.getByRole("button", { name: "Cobros" }).click();
  await page.locator('input[placeholder="Importe cobrado"]').fill("500");
  await page.locator('input[placeholder="Metodo de cobro"]').fill("transferencia");
  await page.locator('input[placeholder="Referencia"]').fill("COBRO-UI-001");
  await page.locator('textarea[placeholder="Notas del cobro"]').fill("Primer cobro parcial");
  await page.getByRole("button", { name: "Registrar cobro parcial" }).click();
  await expect(page.getByText("Primer cobro parcial")).toBeVisible();
  await expect(invoiceCard.getByText("Pendiente:")).toBeVisible();
});

test("fiscal UI creates a real alert and template", async ({ page }) => {
  await login(page);
  await navigateFromSidebar(page, /Fiscal/i, "Panel Fiscal");

  const fiscalAlertDescription = `Alerta fiscal UI ${Date.now()}`;
  const fiscalTemplateDescription = `Plantilla fiscal UI ${Date.now()}`;
  const templateCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Plantilla recurrente", exact: true }),
  });
  const alertCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Nueva alerta", exact: true }),
  });

  await templateCard.locator("textarea").fill(fiscalTemplateDescription);
  await templateCard.getByRole("button", { name: "Crear plantilla" }).click();
  await expect(page.getByText("Plantilla fiscal creada.")).toBeVisible();
  await expect(page.getByText(fiscalTemplateDescription).first()).toBeVisible();

  await alertCard.locator("textarea").fill(fiscalAlertDescription);
  await alertCard.getByRole("button", { name: "Crear alerta" }).click();
  await expect(page.getByText("Alerta fiscal creada.")).toBeVisible();
  await expect(page.getByText(fiscalAlertDescription).first()).toBeVisible();

  await page.getByRole("button", { name: "Preparar" }).first().click();
  await expect(page.getByText("Tramite marcado como prepared.")).toBeVisible();
});

test("labor UI creates assessment, mitigation and verifies storage evidence flow", async ({ page }) => {
  await login(page);
  await navigateFromSidebar(page, /Laboral/i, "Monitor Laboral");

  const scenario = `Escenario laboral UI ${Date.now()} con seguimiento operativo y evidencia`;
  const mitigationTitle = `Mitigacion UI ${Date.now()}`;
  const evidenceLabel = `Evidencia UI ${Date.now()}`;

  await page.getByLabel("Escenario").fill(scenario);
  await page.getByLabel("Risk score (0-1)").fill("0.72");
  await page.getByLabel("Recomendaciones (una por linea)").fill("Separar actividad\nSolicitar criterio legal");
  await page.getByRole("button", { name: "Registrar evaluacion" }).click();

  await expect(page.getByText("Evaluacion laboral registrada.")).toBeVisible();
  await expect(page.getByText(scenario).first()).toBeVisible();

  await page.getByLabel("Titulo").fill(mitigationTitle);
  await page.getByLabel("Descripcion").fill("Mitigacion creada desde Playwright para validar workflow y storage.");
  await page.locator("#mitigationOwnerName").fill("Owner UI");
  await page.getByLabel("Email responsable").fill("owner.ui@example.com");
  await page.getByLabel("Fecha objetivo").fill("2026-04-10");
  await page.getByLabel("SLA compromiso").fill("2026-04-08");
  await page.getByLabel("Seguimiento / evidencias").fill("Seguimiento inicial");
  await page.getByLabel("Checklist (una tarea por linea)").fill("Validar contrato\nRevisar exclusividad");
  await page.getByRole("button", { name: "Crear mitigacion" }).click();

  await expect(page.getByText("Accion de mitigacion creada.")).toBeVisible();
  const mitigationCard = page.locator("div").filter({ has: page.getByText(mitigationTitle, { exact: true }) }).first();
  await expect(mitigationCard).toBeVisible();
  await mitigationCard.getByRole("button", { name: "Gestionar" }).click();

  await page.getByPlaceholder("Etiqueta de la evidencia").fill(evidenceLabel);
  await page.locator('input[type="file"]').setInputFiles(evidenceFixturePath);
  await page.getByRole("button", { name: "Subir evidencia" }).click();

  await expect(page.getByText("Evidencia subida correctamente.")).toBeVisible();
  const evidenceLink = page.getByRole("link", { name: evidenceLabel, exact: true });
  await expect(evidenceLink).toBeVisible();
  await expect(
    mitigationCard.locator("p").filter({ hasText: "labor-evidence.txt · text/plain" }).first()
  ).toBeVisible();

  const popupPromise = page.context().waitForEvent("page");
  await evidenceLink.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL(/supabase|storage|sign/i);
  await popup.close();

  const evidenceDeleteButton = mitigationCard.locator(
    `xpath=.//a[normalize-space()="${evidenceLabel}"]/following::button[normalize-space()="Eliminar"][1]`
  );
  await evidenceDeleteButton.click();
  await expect(page.getByText("Evidencia eliminada.")).toBeVisible();
  await expect(evidenceLink).toHaveCount(0);
});
