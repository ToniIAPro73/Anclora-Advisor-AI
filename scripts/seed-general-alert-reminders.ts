import * as dotenv from "dotenv";
import * as path from "path";
import { buildReminderRunAfter, getNextReminderOccurrence } from "@/lib/alerts/general-alert-reminders";
import { createAppJob } from "@/lib/operations/jobs";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type ReminderPreset = {
  category: "fiscal" | "laboral" | "facturacion";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  recurrence: "monthly" | "quarterly" | "yearly";
  anchorDate: string;
  leadDays: number;
  linkHref: string;
};

const PRESETS: ReminderPreset[] = [
  {
    category: "fiscal",
    title: "Presentacion trimestral IVA",
    message: "Revisar y presentar el modelo 303 antes del vencimiento trimestral.",
    priority: "high",
    recurrence: "quarterly",
    anchorDate: "2026-04-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "Presentacion trimestral IRPF",
    message: "Preparar el modelo 130 y validar importes antes del cierre trimestral.",
    priority: "high",
    recurrence: "quarterly",
    anchorDate: "2026-04-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "Cuota mensual autonomo",
    message: "Confirmar cargo RETA y revisar incidencias bancarias o bonificaciones.",
    priority: "medium",
    recurrence: "monthly",
    anchorDate: "2026-03-31",
    leadDays: 4,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "facturacion",
    title: "Cierre mensual de facturacion",
    message: "Revisar facturas emitidas, cobros pendientes y rectificaciones antes del cierre mensual.",
    priority: "medium",
    recurrence: "monthly",
    anchorDate: "2026-03-25",
    leadDays: 5,
    linkHref: "/dashboard/facturacion",
  },
  {
    category: "facturacion",
    title: "Revision mensual de suscripciones SaaS",
    message: "Comprobar renovaciones, cargos duplicados y herramientas activas para control de coste.",
    priority: "medium",
    recurrence: "monthly",
    anchorDate: "2026-03-01",
    leadDays: 3,
    linkHref: "/dashboard/alertas",
  },
  {
    category: "laboral",
    title: "Revision contractual y compatibilidades",
    message: "Revisar exclusividad, no competencia y cambios contractuales relevantes en pluriactividad.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-09-01",
    leadDays: 21,
    linkHref: "/dashboard/laboral",
  },
];

async function main(): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, is_active")
    .eq("is_active", true);

  if (usersError) {
    throw new Error(usersError.message);
  }

  let inserted = 0;

  for (const user of users ?? []) {
    for (const preset of PRESETS) {
      const { data: existing, error: existingError } = await supabase
        .from("general_alert_reminders")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", preset.title)
        .eq("recurrence", preset.recurrence)
        .eq("anchor_date", preset.anchorDate)
        .limit(1);

      if (existingError) {
        throw new Error(existingError.message);
      }

      if ((existing ?? []).length > 0) {
        continue;
      }

      const { data: createdReminder, error: insertError } = await supabase
        .from("general_alert_reminders")
        .insert({
          user_id: user.id,
          category: preset.category,
          title: preset.title,
          message: preset.message,
          priority: preset.priority,
          recurrence: preset.recurrence,
          anchor_date: preset.anchorDate,
          lead_days: preset.leadDays,
          link_href: preset.linkHref,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError || !createdReminder) {
        throw new Error(insertError.message);
      }

      const nextOccurrence = getNextReminderOccurrence({
        anchorDate: preset.anchorDate,
        recurrence: preset.recurrence,
      });
      await createAppJob({
        userId: user.id,
        jobKind: "general_alert_reminder_generation",
        payload: {
          reminderId: createdReminder.id,
          occurrenceDate: nextOccurrence,
        },
        runAfter: buildReminderRunAfter(nextOccurrence, preset.leadDays),
        maxAttempts: 3,
      });

      inserted += 1;
    }
  }

  console.log(`[SEED] users=${(users ?? []).length} inserted=${inserted}`);
}

main().catch((error) => {
  console.error("[SEED] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
