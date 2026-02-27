"use client";

import { usePathname } from "next/navigation";

const sectionByPath: Record<string, { title: string; subtitle: string }> = {
  "/dashboard/chat": {
    title: "Asesoria RAG",
    subtitle: "Consulta normativa fiscal, laboral y de mercado en un solo flujo.",
  },
  "/dashboard/fiscal": {
    title: "Control Fiscal",
    subtitle: "Calendario, alertas y seguimiento de obligaciones tributarias.",
  },
  "/dashboard/laboral": {
    title: "Monitor Laboral",
    subtitle: "Riesgo de pluriactividad y recomendaciones de mitigacion.",
  },
  "/dashboard/facturacion": {
    title: "Facturacion Inteligente",
    subtitle: "Generacion de facturas con retenciones y reglas aplicables.",
  },
};

interface DashboardTopbarProps {
  userEmail: string;
}

export function DashboardTopbar({ userEmail }: DashboardTopbarProps) {
  const pathname = usePathname();
  const section = sectionByPath[pathname] ?? sectionByPath["/dashboard/chat"];

  return (
    <header className="z-10 shrink-0 border-b border-[#d2dceb] bg-white/90 px-5 py-3 backdrop-blur md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="advisor-heading text-2xl leading-none text-[#162944]">{section.title}</p>
          <p className="mt-1 text-sm text-[#3a4f67]">{section.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="advisor-chip">Sesion activa</span>
          <span className="rounded-full border border-[#d2dceb] bg-[#f2f7ff] px-3 py-1 text-xs font-semibold text-[#1c2b3c]">
            {userEmail}
          </span>
        </div>
      </div>
    </header>
  );
}
