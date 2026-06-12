"use client";

import { usePathname, useRouter } from "next/navigation";
/* eslint-disable no-unused-vars */
import { useRef, useState, type ReactNode } from "react";
import { GeneralAlertCenter } from "@/components/layout/GeneralAlertCenter";
import { useAppPreferences, type ThemeMode } from "@/components/providers/AppPreferencesProvider";
import type { AppRole } from "@/lib/auth/roles";
import { uiText } from "@/lib/i18n/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type SectionCopy = {
  title: string;
  subtitle: string;
};

const sectionByPath: Record<string, Record<"es" | "en", SectionCopy>> = {
  "/dashboard/chat": {
    es: {
      title: "Asesoría RAG",
      subtitle: "Consulta normativa fiscal, laboral y de mercado en un solo flujo.",
    },
    en: {
      title: "RAG Advisory",
      subtitle: "Consult tax, labor, and market guidance in one flow.",
    },
  },
  "/dashboard/fiscal": {
    es: {
      title: "Control Fiscal",
      subtitle: "Calendario, alertas y seguimiento de obligaciones tributarias.",
    },
    en: {
      title: "Tax Control",
      subtitle: "Calendar, alerts, and tracking for tax obligations.",
    },
  },
  "/dashboard/laboral": {
    es: {
      title: "Monitor Laboral",
      subtitle: "Riesgo de pluriactividad y recomendaciones de mitigación.",
    },
    en: {
      title: "Labor Monitor",
      subtitle: "Multi-activity risk and mitigation recommendations.",
    },
  },
  "/dashboard/facturacion": {
    es: {
      title: "Facturación Inteligente",
      subtitle: "Generación de facturas con retenciones y reglas aplicables.",
    },
    en: {
      title: "Smart Invoicing",
      subtitle: "Invoice generation with withholding and applicable rules.",
    },
  },
  "/dashboard/alertas": {
    es: {
      title: "Centro de Alertas",
      subtitle: "Alertas generales, recordatorios recurrentes y seguimiento operativo.",
    },
    en: {
      title: "Alert Center",
      subtitle: "General alerts, recurring reminders, and operational follow-up.",
    },
  },
  "/dashboard/admin": {
    es: {
      title: "Admin RAG",
      subtitle: "Gobernanza de roles, ingesta y estado operativo del conocimiento.",
    },
    en: {
      title: "RAG Admin",
      subtitle: "Role governance, ingestion, and knowledge runtime status.",
    },
  },
};

interface DashboardTopbarProps {
  userEmail: string;
  role: AppRole;
}

export function DashboardTopbar({ userEmail, role }: DashboardTopbarProps) {
  const pathname = usePathname();
  const { locale, setLocale, themeMode, setThemeMode } = useAppPreferences();
  const section =
    sectionByPath[pathname]?.[locale] ??
    sectionByPath["/dashboard/chat"][locale];

  return (
    <header
      className="relative z-30 shrink-0 border-b px-5 py-3 backdrop-blur md:px-6"
      style={{
        borderColor: "var(--advisor-border)",
        background: "color-mix(in srgb, var(--advisor-panel) 84%, transparent)",
      }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="advisor-heading truncate whitespace-nowrap text-2xl leading-none" style={{ color: "var(--text-primary)" }}>{section.title}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{section.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <GeneralAlertCenter locale={locale} />
          <ThemeToggleGroup current={themeMode} onChange={setThemeMode} locale={locale} />
          <LocaleToggle current={locale} onChange={setLocale} locale={locale} />
          <span className="advisor-chip">{uiText(locale, "common.role")}: {role}</span>
          <UserMenu userEmail={userEmail} locale={locale} />
        </div>
      </div>
    </header>
  );
}

function getUserInitials(email: string): string {
  const prefix = email.split("@")[0] ?? email;
  return prefix.slice(0, 2).toUpperCase();
}

function UserMenu({ userEmail, locale }: { userEmail: string; locale: "es" | "en" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={userEmail}
        title={userEmail}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition hover:opacity-80"
        style={{
          background: "var(--advisor-accent, #1DAB89)",
          color: "#fff",
        }}
      >
        {getUserInitials(userEmail)}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border py-1 shadow-lg"
          style={{
            background: "var(--advisor-panel)",
            borderColor: "var(--advisor-border)",
          }}
        >
          <p
            className="truncate px-4 py-2 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {userEmail}
          </p>
          <div style={{ borderTop: "1px solid var(--advisor-border)" }} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{ color: "var(--text-primary)" }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {locale === "es" ? "Cerrar sesión" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggleGroup({
  current,
  onChange,
  locale,
}: {
  current: ThemeMode;
  onChange(themeMode: ThemeMode): void;
  locale: "es" | "en";
}) {
  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    {
      value: "light",
      label: uiText(locale, "common.theme.light"),
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: uiText(locale, "common.theme.dark"),
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: uiText(locale, "common.theme.system"),
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="advisor-toggle"
      role="group"
      aria-label={uiText(locale, "common.theme")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`advisor-toggle-option advisor-toggle-option-icon ${current === option.value ? "is-active" : ""}`}
          aria-label={option.label}
          aria-pressed={current === option.value}
          title={option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function LocaleToggle({
  current,
  onChange,
  locale,
}: {
  current: "es" | "en";
  onChange(locale: "es" | "en"): void;
  locale: "es" | "en";
}) {
  return (
    <div
      className="advisor-toggle"
      role="group"
      aria-label={uiText(locale, "common.language")}
    >
      {(["es", "en"] as const).map((itemLocale) => (
        <button
          key={itemLocale}
          type="button"
          className={`advisor-toggle-option px-3 text-xs font-semibold ${current === itemLocale ? "is-active" : ""}`}
          aria-pressed={current === itemLocale}
          onClick={() => onChange(itemLocale)}
        >
          {itemLocale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
