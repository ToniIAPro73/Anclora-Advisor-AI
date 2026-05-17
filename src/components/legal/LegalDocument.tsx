import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";

export type LegalBlock = {
  title: string;
  paragraphs: string[];
};

export function LegalDocument({
  title,
  description,
  blocks,
}: {
  title: string;
  description: string;
  blocks: LegalBlock[];
}) {
  return (
    <main className="min-h-screen px-5 py-10" style={{ background: "var(--advisor-canvas)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border p-8" style={{ borderColor: "var(--advisor-border)", background: "var(--advisor-panel)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--advisor-accent)" }}>Anclora Advisor AI</p>
          <h1 className="advisor-heading mt-3 text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{description}</p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>Última actualización: 17 de mayo de 2026</p>
        </section>
        <section className="space-y-4 rounded-3xl border p-6" style={{ borderColor: "var(--advisor-border)", background: "var(--advisor-panel)" }}>
          {blocks.map((block) => (
            <article key={block.title} className="rounded-2xl border p-5" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 90%, var(--advisor-light))" }}>
              <h2 className="advisor-heading text-2xl">{block.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                {block.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
          ))}
        </section>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/terms" className="advisor-btn advisor-btn-secondary">Términos</Link>
          <Link href="/privacy" className="advisor-btn advisor-btn-secondary">Privacidad</Link>
          <Link href="/legal" className="advisor-btn advisor-btn-secondary">Aviso legal</Link>
          <Link href="/login" className="advisor-btn advisor-btn-primary">Volver</Link>
        </nav>
      </div>
      <LegalFooter />
    </main>
  );
}
