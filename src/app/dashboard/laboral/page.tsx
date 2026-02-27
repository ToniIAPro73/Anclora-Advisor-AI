export default function DashboardLaboralPage() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="advisor-card p-6 lg:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Monitor Laboral</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Estructura visual preparada para score de riesgo y trazabilidad de recomendaciones laborales.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Risk score</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Componente reservado</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Historial</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Tabla de evaluaciones preparada</p>
          </div>
        </div>
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Nivel de avance</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">Shell visual listo</p>
        <div className="mt-4 h-2 w-full rounded-full bg-[#dce4f4]">
          <div className="h-2 w-[40%] rounded-full bg-[#1dab89]" />
        </div>
      </aside>
    </section>
  );
}
