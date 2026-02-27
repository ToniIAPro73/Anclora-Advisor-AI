import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { getCurrentUserFromCookies } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 md:flex">
      <DashboardNav />
      <div className="flex-1">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <p className="text-sm text-slate-500">Sesion activa: {user.email}</p>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
