"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/dashboard/fiscal", label: "Fiscal" },
  { href: "/dashboard/laboral", label: "Laboral" },
  { href: "/dashboard/facturacion", label: "Facturacion" },
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
    <aside className="w-full border-b border-slate-700 bg-slate-900 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="px-4 py-4">
        <p className="text-lg font-semibold text-slate-50">Anclora Advisor</p>
      </div>
      <nav className="flex flex-wrap gap-2 px-4 pb-4 md:flex-col">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-4 pb-4 md:block">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}

