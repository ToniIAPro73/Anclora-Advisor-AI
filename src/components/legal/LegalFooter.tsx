"use client";

import Link from "next/link";

const links = [
  { type: "link" as const, href: "/terms", label: "Términos" },
  { type: "link" as const, href: "/privacy", label: "Privacidad" },
  { type: "link" as const, href: "/legal", label: "Aviso legal" },
  { type: "mailto" as const, href: "mailto:hola@anclora.com", label: "hola@anclora.com" },
];

export function LegalFooter({ compact = false }: { compact?: boolean }) {
  const year = new Date().getFullYear();

  if (compact) {
    return (
      <footer
        className="shrink-0 border-t px-5 py-3"
        style={{ borderColor: "var(--advisor-border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span
            className="text-[11px] tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            © {year} Anclora Group
          </span>

          <div className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            {links.map((l, i) => (
              <span key={l.href} className="flex items-center gap-1">
                {i > 0 && <span className="select-none opacity-30">·</span>}
                {l.type === "link" ? (
                  <Link
                    href={l.href}
                    className="text-[11px] transition-opacity hover:opacity-100 opacity-60"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    href={l.href}
                    className="text-[11px] transition-opacity hover:opacity-100 opacity-60"
                  >
                    {l.label}
                  </a>
                )}
              </span>
            ))}
            <span className="select-none opacity-30">·</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("anclora:open-cookie-preferences"))}
              className="text-[11px] transition-opacity hover:opacity-100 opacity-60"
            >
              Cookies
            </button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="border-t px-6 py-6 text-xs"
      style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            Anclora Advisor AI
          </p>
          <p className="mt-0.5 opacity-60">
            © {year} Anclora Group — Todos los derechos reservados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 opacity-70">
          {links.map((l, i) => (
            <span key={l.href} className="flex items-center gap-1">
              {i > 0 && <span className="select-none opacity-40">·</span>}
              {l.type === "link" ? (
                <Link href={l.href} className="hover:opacity-100 transition-opacity">
                  {l.label}
                </Link>
              ) : (
                <a href={l.href} className="hover:opacity-100 transition-opacity">
                  {l.label}
                </a>
              )}
            </span>
          ))}
          <span className="select-none opacity-40">·</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("anclora:open-cookie-preferences"))}
            className="hover:opacity-100 transition-opacity"
          >
            Cookies
          </button>
        </div>
      </div>
    </footer>
  );
}
