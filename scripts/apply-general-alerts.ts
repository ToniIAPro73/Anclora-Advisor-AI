import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MIGRATION_PATHS = [
  path.resolve(process.cwd(), "supabase/migrations/20260303_general_alerts_v1.sql"),
  path.resolve(process.cwd(), "supabase/migrations/20260303_general_alert_reminders_v1.sql"),
];

function getConnectionString(): string {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";
}

async function main(): Promise<void> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error("[APPLY] Missing DATABASE_URL/SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }

  for (const migrationPath of MIGRATION_PATHS) {
    if (!fs.existsSync(migrationPath)) {
      console.error(`[APPLY] Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("[APPLY] Connecting to Supabase Postgres...");
    await client.connect();
    for (const migrationPath of MIGRATION_PATHS) {
      const sql = fs.readFileSync(migrationPath, "utf8");
      console.log(`[APPLY] Applying ${path.basename(migrationPath)}...`);
      await client.query(sql);
    }
    console.log("[APPLY] OK - general alerts migrations applied successfully.");
  } catch (error) {
    console.error("[APPLY] ERROR:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[APPLY] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
