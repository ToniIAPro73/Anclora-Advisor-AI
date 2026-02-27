export default function DashboardFacturacionPage() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="advisor-card p-6 lg:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Facturacion</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Base de experiencia lista para formularios de factura, reglas de IVA e IRPF y trazabilidad de estados.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Motor de calculo</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Pendiente de ANCLORA-INV-001</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Persistencia</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">Estructura UI preparada</p>
          </div>
        </div>
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Objetivo de modulo</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">Factura lista para emitir</p>
        <p className="mt-3 text-sm text-[#3a4f67]">Con calculo automatico y validaciones de negocio.</p>
      </aside>
    </section>
  );
}
