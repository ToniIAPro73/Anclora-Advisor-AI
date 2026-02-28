import * as dotenv from "dotenv";
import * as path from "path";
import { processPendingAppJobsForAllUsers } from "@/lib/operations/processors";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main(): Promise<void> {
  const result = await processPendingAppJobsForAllUsers({
    userLimit: 250,
    jobsPerUserLimit: 25,
  });
  console.log(
    `[OPS] users=${result.userCount} claimed=${result.claimed} completed=${result.completed} failed=${result.failed}`
  );
}

main().catch((error) => {
  console.error("[OPS] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
