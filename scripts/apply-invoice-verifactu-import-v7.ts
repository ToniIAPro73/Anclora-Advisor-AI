import * as path from "path";
import * as fs from "fs/promises";
import { Client } from "pg";

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/20260303_invoice_verifactu_pdf_import_v7.sql");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required");
  }

  const sql = await fs.readFile(MIGRATION_PATH, "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log("[APPLY] Connected. Applying invoice Verifactu/import v7 migration...");
    await client.query(sql);
    console.log("[APPLY] OK - invoice Verifactu/import v7 migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[APPLY] ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
