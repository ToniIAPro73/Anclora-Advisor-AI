"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/lib/auth/roles";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const baseLinks = [
  {
    href: "/dashboard/chat",
    label: { es: "Chat", en: "Chat" },
    subtitle: { es: "Asesoria RAG", en: "RAG advisory" },
  },
  {
    href: "/dashboard/fiscal",
    label: { es: "Fiscal", en: "Tax" },
    subtitle: { es: "Impuestos y plazos", en: "Taxes and deadlines" },
  },
  {
    href: "/dashboard/laboral",
    label: { es: "Laboral", en: "Labor" },
    subtitle: { es: "Riesgos y acciones", en: "Risks and actions" },
  },
  {
    href: "/dashboard/facturacion",
    label: { es: "Facturacion", en: "Invoicing" },
    subtitle: { es: "Facturas y retencion", en: "Invoices and withholding" },
  },
];

const adminLink = {
  href: "/dashboard/admin",
  label: { es: "Admin", en: "Admin" },
  subtitle: { es: "Ingesta y control RAG", en: "RAG ingest and control" },
};

interface DashboardNavProps {
  role: AppRole;
}

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, resolvedTheme, sidebarCollapsed: collapsed, setSidebarCollapsed } = useAppPreferences();
  const links = role === "admin" ? [...baseLinks, adminLink] : baseLinks;

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside
      className={`advisor-sidebar w-full border-b transition-[width] duration-200 md:flex md:h-full md:flex-col md:border-b-0 md:border-r ${
        collapsed ? "md:w-[92px]" : "md:w-[290px]"
      }`}
      style={{ borderColor: "var(--sidebar-border)" }}
    >
      <div className="px-5 py-4 md:px-6 md:py-5">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3.5"}`}>
          <Image
            src="/brand/logo-Advisor.png"
            alt="Anclora Advisor"
            width={44}
            height={44}
            className="advisor-sidebar-logo-shell h-11 w-11 rounded-full object-cover"
            style={{
              background: resolvedTheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(22,41,68,0.05)",
              boxShadow: resolvedTheme === "dark" ? "0 10px 22px rgba(3,8,18,0.35)" : "0 10px 22px rgba(20,40,65,0.12)",
            }}
          />
          {!collapsed && (
            <div className="pt-0.5">
              <p className="advisor-heading text-[30px] leading-[0.95]" style={{ color: "var(--sidebar-text-strong)" }}>
                ANCLORA
              </p>
              <p
                className="mt-1 text-[11px] font-semibold uppercase"
                style={{ color: "var(--sidebar-text-strong)", letterSpacing: "0.92em" }}
              >
                ADVISOR AI
              </p>
            </div>
          )}
        </div>
        <div className="mt-3 hidden md:flex md:justify-end">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!collapsed)}
            className="advisor-sidebar-control inline-flex h-8 w-8 items-center justify-center rounded-lg transition"
            style={{ color: "var(--sidebar-text-strong)" }}
            aria-label={collapsed ? (locale === "es" ? "Expandir sidebar" : "Expand sidebar") : (locale === "es" ? "Contraer sidebar" : "Collapse sidebar")}
            title={collapsed ? (locale === "es" ? "Expandir sidebar" : "Expand sidebar") : (locale === "es" ? "Contraer sidebar" : "Collapse sidebar")}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 px-4 pb-4 md:flex-1 md:flex-col md:px-5">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label[locale] : undefined}
              className={`advisor-sidebar-link group px-4 py-3 text-sm ${collapsed ? "md:px-2 md:py-2.5" : ""}`}
              data-active={isActive}
              style={{ color: isActive ? "var(--sidebar-text-strong)" : "var(--sidebar-text)" }}
            >
              <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
                <span className="font-semibold">{collapsed ? link.label[locale].slice(0, 1) : link.label[locale]}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${collapsed ? "hidden" : ""}`}
                  style={{ background: isActive ? "#1DAB89" : "var(--sidebar-dot-inactive)" }}
                />
              </div>
              {!collapsed && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: isActive ? "var(--sidebar-subtitle-active)" : "var(--sidebar-subtitle)" }}
                >
                  {link.subtitle[locale]}
                </p>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-4 md:mt-auto md:px-5 md:pb-6">
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? (locale === "es" ? "Cerrar sesion" : "Sign out") : undefined}
          className={`advisor-sidebar-logout rounded-xl py-2.5 text-sm font-semibold transition ${
            collapsed ? "w-full px-2" : "w-full px-3"
          }`}
          style={{ color: "var(--sidebar-text-strong)" }}
        >
          {collapsed ? (locale === "es" ? "Salir" : "Exit") : (locale === "es" ? "Cerrar sesion" : "Sign out")}
        </button>
      </div>
    </aside>
  );
}

