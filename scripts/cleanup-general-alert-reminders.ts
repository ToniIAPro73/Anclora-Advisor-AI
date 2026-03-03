import * as dotenv from "dotenv";
import * as path from "path";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const LEGACY_TITLES = [
  "Presentacion trimestral IVA",
  "Presentacion trimestral IRPF",
];

async function main(): Promise<void> {
  const supabase = createServiceSupabaseClient();

  const { data: reminders, error: reminderError } = await supabase
    .from("general_alert_reminders")
    .select("id")
    .in("title", LEGACY_TITLES);

  if (reminderError) {
    throw new Error(reminderError.message);
  }

  const reminderIds = (reminders ?? []).map((item) => item.id);

  if (reminderIds.length === 0) {
    console.log("[CLEANUP] reminders=0 alerts=0 jobs=0");
    return;
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("app_jobs")
    .select("id, payload")
    .eq("job_kind", "general_alert_reminder_generation")
    .limit(500);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const jobIds = (jobs ?? [])
    .filter((job) => {
      const payload = job.payload as Record<string, unknown> | null;
      return typeof payload?.reminderId === "string" && reminderIds.includes(payload.reminderId);
    })
    .map((job) => job.id);

  const { data: alerts, error: alertsError } = await supabase
    .from("general_alerts")
    .select("id, source_entity_id")
    .eq("source", "reminder")
    .limit(500);

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const alertIds = (alerts ?? [])
    .filter((alert) => typeof alert.source_entity_id === "string" && reminderIds.includes(alert.source_entity_id))
    .map((alert) => alert.id);

  if (jobIds.length > 0) {
    const { error } = await supabase.from("app_jobs").delete().in("id", jobIds);
    if (error) {
      throw new Error(error.message);
    }
  }

  if (alertIds.length > 0) {
    const { error } = await supabase.from("general_alerts").delete().in("id", alertIds);
    if (error) {
      throw new Error(error.message);
    }
  }

  const { error: deleteReminderError } = await supabase
    .from("general_alert_reminders")
    .delete()
    .in("id", reminderIds);

  if (deleteReminderError) {
    throw new Error(deleteReminderError.message);
  }

  console.log(`[CLEANUP] reminders=${reminderIds.length} alerts=${alertIds.length} jobs=${jobIds.length}`);
}

main().catch((error) => {
  console.error("[CLEANUP] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
