"use client";

import { usePathname } from "next/navigation";
/* eslint-disable no-unused-vars */
import type { ReactNode } from "react";
import { useAppPreferences, type ThemeMode } from "@/components/providers/AppPreferencesProvider";
import type { AppRole } from "@/lib/auth/roles";
import { uiText } from "@/lib/i18n/ui";

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
      className="z-10 shrink-0 border-b px-5 py-3 backdrop-blur md:px-6"
      style={{
        borderColor: "var(--advisor-border)",
        background: "color-mix(in srgb, var(--advisor-panel) 84%, transparent)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="advisor-heading text-2xl leading-none" style={{ color: "var(--text-primary)" }}>{section.title}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{section.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggleGroup current={themeMode} onChange={setThemeMode} locale={locale} />
          <LocaleToggle current={locale} onChange={setLocale} locale={locale} />
          <span className="advisor-chip">{uiText(locale, "common.role")}: {role}</span>
          <span
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "var(--advisor-border)",
              background: "color-mix(in srgb, var(--advisor-panel) 92%, var(--advisor-light))",
              color: "var(--text-primary)",
            }}
          >
            {userEmail}
          </span>
        </div>
      </div>
    </header>
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
      className="flex items-center gap-1 rounded-2xl border p-1"
      style={{
        borderColor: "var(--advisor-border)",
        background: "color-mix(in srgb, var(--advisor-panel) 94%, transparent)",
      }}
      aria-label={uiText(locale, "common.theme")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="advisor-icon-toggle"
          data-active={current === option.value}
          aria-label={option.label}
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
      className="flex items-center gap-1 rounded-2xl border p-1"
      style={{
        borderColor: "var(--advisor-border)",
        background: "color-mix(in srgb, var(--advisor-panel) 94%, transparent)",
      }}
      aria-label={uiText(locale, "common.language")}
    >
      {(["es", "en"] as const).map((itemLocale) => (
        <button
          key={itemLocale}
          type="button"
          className="rounded-xl px-3 py-2 text-xs font-semibold transition"
          style={{
            background: current === itemLocale ? "var(--advisor-accent)" : "transparent",
            color: current === itemLocale ? "var(--text-on-accent)" : "var(--text-secondary)",
          }}
          aria-pressed={current === itemLocale}
          onClick={() => onChange(itemLocale)}
        >
          {itemLocale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
