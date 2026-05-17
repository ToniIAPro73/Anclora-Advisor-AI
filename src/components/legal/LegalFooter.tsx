"use client";

import Link from "next/link";

export function LegalFooter({ compact = false }: { compact?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className={compact ? "mt-3 text-xs" : "border-t px-5 py-5 text-xs"} style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
      <div className={compact ? "space-y-2" : "mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between"}>
        <div className="space-y-1">
          <p>© {year} Anclora Group — Todos los derechos reservados.</p>
          <p>Anclora Advisor AI forma parte del ecosistema tecnológico de Anclora Group.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="hover:underline">Términos del servicio</Link>
          <Link href="/privacy" className="hover:underline">Política de privacidad</Link>
          <Link href="/legal" className="hover:underline">Aviso legal</Link>
          <a href="mailto:hola@anclora.com" className="hover:underline">hola@anclora.com</a>
          <button type="button" onClick={() => window.dispatchEvent(new Event("anclora:open-cookie-preferences"))} className="hover:underline">Cookies</button>
        </div>
      </div>
    </footer>
  );
}
