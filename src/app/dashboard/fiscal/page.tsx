export default function DashboardFiscalPage() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="advisor-card p-6 lg:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Panel Fiscal</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">Base de interfaz lista para Cuota Cero y linea temporal de modelos 303 y 130.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cuota Cero</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Widget en fase de datos</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Timeline fiscal</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Estructura de vencimientos preparada</p>
          </div>
        </div>
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Siguiente feature</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">ANCLORA-FISC-001</p>
        <p className="mt-3 text-sm text-[#3a4f67]">Incluira integracion real con alertas y estado de cumplimiento.</p>
      </aside>
    </section>
  );
}
