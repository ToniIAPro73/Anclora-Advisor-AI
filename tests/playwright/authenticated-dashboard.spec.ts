import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getSupabaseAnonKey, getSupabaseUrl } from "../../src/lib/env";
import { createServiceSupabaseClient } from "../../src/lib/supabase/server-admin";

let tempUserId: string | null = null;
const tempEmail = `playwright_${Date.now()}@anclora.local`;
const tempPassword = `Pw-${Date.now()}-UI!`;

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
  await page.goto("/login");

  await page.getByLabel("Correo electrónico").fill(tempEmail);
  await page.locator("#password").fill(tempPassword);
  await page.getByRole("button", { name: "Entrar al dashboard" }).click();

  await page.waitForURL("**/dashboard/chat");
  await expect(page.getByRole("heading", { name: "Workspace Conversacional", exact: true })).toBeVisible();
  const sidebar = page.locator("aside");

  await sidebar.getByRole("link", { name: /Fiscal/i }).click();
  await expect(page.getByRole("heading", { name: "Panel Fiscal", exact: true })).toBeVisible();

  await sidebar.getByRole("link", { name: /Laboral/i }).click();
  await expect(page.getByRole("heading", { name: "Monitor Laboral", exact: true })).toBeVisible();

  await sidebar.getByRole("link", { name: /Facturacion/i }).click();
  await expect(page.getByRole("heading", { name: "Facturacion", exact: true })).toBeVisible();

  const clientName = `Cliente UI ${Date.now()}`;
  await page.getByLabel("Cliente").fill(clientName);
  await page.getByLabel("NIF/CIF").fill("B12345678");
  await page.getByLabel("Serie").fill("PWUI");
  await page.getByLabel("Email destinatario").fill("cliente.ui@example.com");
  await page.getByRole("button", { name: "Guardar borrador" }).click();

  await expect(page.getByText("Factura guardada en borrador.")).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.getByPlaceholder("Cliente o NIF").fill(clientName);
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText(clientName)).toBeVisible();
});
