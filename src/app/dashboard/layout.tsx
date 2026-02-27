import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import { getCurrentUserFromCookies } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="advisor-shell h-screen overflow-hidden text-slate-900 md:flex">
      <DashboardNav />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar userEmail={user.email ?? "usuario@anclora.ai"} />
        <main className="flex-1 overflow-hidden p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
