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
    title: "IVA trimestral Q1",
    message: "Revisar y presentar el modelo 303 del primer trimestre.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-04-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IVA trimestral Q2",
    message: "Revisar y presentar el modelo 303 del segundo trimestre.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-07-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IVA trimestral Q3",
    message: "Revisar y presentar el modelo 303 del tercer trimestre.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-10-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IVA trimestral Q4",
    message: "Revisar y presentar el modelo 303 del cuarto trimestre.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-01-30",
    leadDays: 12,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IRPF trimestral Q1",
    message: "Preparar el modelo 130 del primer trimestre y validar importes.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-04-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IRPF trimestral Q2",
    message: "Preparar el modelo 130 del segundo trimestre y validar importes.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-07-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IRPF trimestral Q3",
    message: "Preparar el modelo 130 del tercer trimestre y validar importes.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-10-20",
    leadDays: 10,
    linkHref: "/dashboard/fiscal",
  },
  {
    category: "fiscal",
    title: "IRPF trimestral Q4",
    message: "Preparar el modelo 130 del cuarto trimestre y validar importes.",
    priority: "high",
    recurrence: "yearly",
    anchorDate: "2026-01-30",
    leadDays: 12,
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

const LEGACY_TITLES = [
  "Presentacion trimestral IVA",
  "Presentacion trimestral IRPF",
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
  let updated = 0;
  let deactivated = 0;

  for (const user of users ?? []) {
    const { data: legacyRows, error: legacyError } = await supabase
      .from("general_alert_reminders")
      .select("id")
      .eq("user_id", user.id)
      .in("title", LEGACY_TITLES)
      .eq("is_active", true);

    if (legacyError) {
      throw new Error(legacyError.message);
    }

    for (const row of legacyRows ?? []) {
      const { error: deactivateError } = await supabase
        .from("general_alert_reminders")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (deactivateError) {
        throw new Error(deactivateError.message);
      }
      deactivated += 1;
    }

    for (const preset of PRESETS) {
      const { data: existing, error: existingError } = await supabase
        .from("general_alert_reminders")
        .select("id, title, category, message, priority, recurrence, anchor_date, lead_days, link_href, is_active")
        .eq("user_id", user.id)
        .eq("title", preset.title)
        .limit(1);

      if (existingError) {
        throw new Error(existingError.message);
      }

      if ((existing ?? []).length > 0) {
        const current = existing[0];
        const needsUpdate =
          current.category !== preset.category ||
          current.message !== preset.message ||
          current.priority !== preset.priority ||
          current.recurrence !== preset.recurrence ||
          current.anchor_date !== preset.anchorDate ||
          current.lead_days !== preset.leadDays ||
          current.link_href !== preset.linkHref ||
          current.is_active !== true;

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from("general_alert_reminders")
            .update({
              category: preset.category,
              message: preset.message,
              priority: preset.priority,
              recurrence: preset.recurrence,
              anchor_date: preset.anchorDate,
              lead_days: preset.leadDays,
              link_href: preset.linkHref,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", current.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          updated += 1;
        }
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

  console.log(`[SEED] users=${(users ?? []).length} inserted=${inserted} updated=${updated} deactivated=${deactivated}`);
}

main().catch((error) => {
  console.error("[SEED] Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
