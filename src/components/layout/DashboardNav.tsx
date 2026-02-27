"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="advisor-sidebar w-full border-b border-white/10 md:h-screen md:w-[290px] md:border-b-0 md:border-r md:border-r-white/10">
      <div className="px-5 py-5 md:px-6 md:py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/Logo-Advisor.png"
            alt="Anclora Advisor"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full border border-white/25 bg-white/10 p-1 shadow-lg shadow-black/30"
          />
          <div>
            <p className="advisor-heading text-2xl leading-none text-white">Anclora</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#A1DBC6]">Advisor AI</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 px-4 pb-4 md:flex-col md:px-5">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group rounded-xl px-4 py-3 text-sm transition ${
                isActive
                  ? "border border-[#A1DBC6]/40 bg-white/10 text-white shadow-md shadow-black/25"
                  : "border border-transparent bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{link.label}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isActive ? "bg-[#1DAB89]" : "bg-white/20 group-hover:bg-white/45"
                  }`}
                />
              </div>
              <p className={`mt-1 text-xs ${isActive ? "text-[#A1DBC6]" : "text-slate-400 group-hover:text-slate-300"}`}>
                {link.subtitle}
              </p>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-4 md:mt-auto md:px-5 md:pb-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl border border-white/30 bg-transparent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
