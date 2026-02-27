export default function DashboardChatPage() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <article className="advisor-card p-6 md:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Nucleo Conversacional</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#3a4f67]">
          El shell del dashboard ya incorpora estructura premium. La fase siguiente integra el flujo completo del chat con citas
          y alertas criticas.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Estado del modulo</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Preparado para ANCLORA-CHAT-002</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Contrato API</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">`/api/chat` estable</p>
          </div>
        </div>
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Prioridad actual</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">Integrar experiencias de consulta con fuentes</p>
        <div className="mt-4 h-2 w-full rounded-full bg-[#dce4f4]">
          <div className="h-2 w-[35%] rounded-full bg-[#1dab89]" />
        </div>
      </aside>
    </section>
  );
}
