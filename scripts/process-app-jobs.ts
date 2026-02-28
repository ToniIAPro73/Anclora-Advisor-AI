import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { processPendingAppJobs } from "@/lib/operations/processors";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await supabase
    .from("app_jobs")
    .select("user_id")
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  const userIds = Array.from(new Set((data ?? []).map((item) => item.user_id).filter(Boolean)));
  console.log(`[OPS] Pending job users: ${userIds.length}`);

  for (const userId of userIds) {
    const result = await processPendingAppJobs({ userId, limit: 25 });
    console.log(`[OPS] user=${userId} claimed=${result.claimed} completed=${result.completed} failed=${result.failed}`);
  }
}

main().catch((error) => {
  console.error("[OPS] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
