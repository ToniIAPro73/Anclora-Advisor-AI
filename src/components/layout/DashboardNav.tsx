"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard/chat", label: "Chat", subtitle: "Asesoria RAG" },
  { href: "/dashboard/fiscal", label: "Fiscal", subtitle: "Impuestos y plazos" },
  { href: "/dashboard/laboral", label: "Laboral", subtitle: "Riesgos y acciones" },
  { href: "/dashboard/facturacion", label: "Facturacion", subtitle: "Facturas y retencion" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside
      className={`advisor-sidebar w-full border-b border-white/10 transition-[width] duration-200 md:flex md:h-full md:flex-col md:border-b-0 md:border-r md:border-r-white/10 ${
        collapsed ? "md:w-[92px]" : "md:w-[290px]"
      }`}
    >
      <div className="px-5 py-4 md:px-6 md:py-5">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3.5"}`}>
          <Image
            src="/brand/logo-Advisor.png"
            alt="Anclora Advisor"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full border border-white/25 bg-white/10 shadow-lg shadow-black/30 object-cover"
          />
          {!collapsed && (
            <div className="pt-0.5">
              <p className="advisor-heading text-[30px] leading-[0.95] text-white">Anclora</p>
              <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-[#A1DBC6]">ADVISOR AI</p>
            </div>
          )}
        </div>
        <div className="mt-3 hidden md:flex md:justify-end">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/5 text-white transition hover:bg-white/15"
            aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
            title={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
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
              title={collapsed ? link.label : undefined}
              className={`group rounded-xl px-4 py-3 text-sm transition ${
                isActive
                  ? "border border-[#A1DBC6]/40 bg-white/10 text-white shadow-md shadow-black/25"
                  : "border border-transparent bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
              } ${collapsed ? "md:px-2 md:py-2.5" : ""}`}
            >
              <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
                <span className="font-semibold">{collapsed ? link.label.slice(0, 1) : link.label}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isActive ? "bg-[#1DAB89]" : "bg-white/20 group-hover:bg-white/45"
                  } ${collapsed ? "hidden" : ""}`}
                />
              </div>
              {!collapsed && (
                <p className={`mt-1 text-xs ${isActive ? "text-[#A1DBC6]" : "text-slate-400 group-hover:text-slate-300"}`}>
                  {link.subtitle}
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
          title={collapsed ? "Cerrar sesion" : undefined}
          className={`rounded-xl border border-white/30 bg-transparent py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 ${
            collapsed ? "w-full px-2" : "w-full px-3"
          }`}
        >
          {collapsed ? "Salir" : "Cerrar sesion"}
        </button>
      </div>
    </aside>
  );
}
