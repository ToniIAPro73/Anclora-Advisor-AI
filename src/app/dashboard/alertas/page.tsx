import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GeneralAlertsWorkspace } from "@/components/features/GeneralAlertsWorkspace";
import type { GeneralAlertReminderRecord } from "@/lib/alerts/general-alert-reminders";
import type { GeneralAlertRecord } from "@/lib/alerts/general-alerts";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/messages";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

export default async function DashboardAlertasPage() {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();

  if (!user || !accessToken) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("anclora.locale")?.value);
  const supabase = createUserScopedSupabaseClient(accessToken);

  const [{ data: alertsData }, { data: remindersData }] = await Promise.all([
    supabase
      .from("general_alerts")
      .select("id, user_id, source_key, source, source_entity_type, source_entity_id, category, title, message, priority, status, due_date, link_href, metadata, read_at, browser_notified_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("general_alert_reminders")
      .select("id, user_id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active, last_generated_for, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-4 pr-1">
        <GeneralAlertsWorkspace
          initialAlerts={(alertsData ?? []) as GeneralAlertRecord[]}
          initialReminders={(remindersData ?? []) as GeneralAlertReminderRecord[]}
          locale={locale}
        />
      </div>
    </section>
  );
}
