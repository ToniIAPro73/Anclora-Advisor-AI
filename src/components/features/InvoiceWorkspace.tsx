"use client";

import { useMemo, useState } from "react";

export interface InvoiceRecord {
  id: string;
  client_name: string;
  client_nif: string;
  amount_base: number;
  iva_rate: number;
  irpf_retention: number;
  total_amount: number;
  issue_date: string;
  status: string;
  created_at: string;
}

interface InvoiceWorkspaceProps {
  initialInvoices: InvoiceRecord[];
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function InvoiceWorkspace({ initialInvoices }: InvoiceWorkspaceProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [clientName, setClientName] = useState("");
  const [clientNif, setClientNif] = useState("");
  const [amountBase, setAmountBase] = useState("1000");
  const [ivaRate, setIvaRate] = useState("21");
  const [irpfRetention, setIrpfRetention] = useState("15");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    const base = toNumber(amountBase);
    const iva = toNumber(ivaRate);
    const irpf = toNumber(irpfRetention);
    return round2(base + (base * iva) / 100 - (base * irpf) / 100);
  }, [amountBase, ivaRate, irpfRetention]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientNif: clientNif.trim().toUpperCase(),
          amountBase: toNumber(amountBase),
          ivaRate: toNumber(ivaRate),
          irpfRetention: toNumber(irpfRetention),
          issueDate,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoice?: InvoiceRecord;
      };

      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo crear la factura");
      }

      setInvoices((prev) => [result.invoice as InvoiceRecord, ...prev].slice(0, 30));
      setOkMessage("Factura guardada en borrador.");
      setClientName("");
      setClientNif("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar factura");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <article className="advisor-card min-h-0 p-4 lg:col-span-2">
        <h2 className="advisor-heading text-2xl text-[#162944]">Nueva factura</h2>
        <p className="mt-1 text-sm text-[#3a4f67]">Calculo automatico de IVA e IRPF con guardado en borrador.</p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="advisor-label" htmlFor="clientName">Cliente</label>
            <input id="clientName" className="advisor-input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>
          <div>
            <label className="advisor-label" htmlFor="clientNif">NIF/CIF</label>
            <input id="clientNif" className="advisor-input" value={clientNif} onChange={(e) => setClientNif(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="advisor-label" htmlFor="amountBase">Base imponible</label>
              <input id="amountBase" type="number" step="0.01" min="0" className="advisor-input" value={amountBase} onChange={(e) => setAmountBase(e.target.value)} required />
            </div>
            <div>
              <label className="advisor-label" htmlFor="issueDate">Fecha de emision</label>
              <input id="issueDate" type="date" className="advisor-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="advisor-label" htmlFor="ivaRate">IVA %</label>
              <input id="ivaRate" type="number" step="0.01" min="0" max="100" className="advisor-input" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} required />
            </div>
            <div>
              <label className="advisor-label" htmlFor="irpfRetention">Retencion IRPF %</label>
              <input id="irpfRetention" type="number" step="0.01" min="0" max="100" className="advisor-input" value={irpfRetention} onChange={(e) => setIrpfRetention(e.target.value)} required />
            </div>
          </div>

          <div className="advisor-card-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Total estimado</p>
            <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(previewTotal)}</p>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {okMessage && <p className="text-sm text-emerald-700">{okMessage}</p>}

          <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
            {submitting ? "Guardando..." : "Guardar borrador"}
          </button>
        </form>
      </article>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <h3 className="advisor-heading text-2xl text-[#162944]">Facturas recientes</h3>
          <p className="mt-1 text-sm text-[#3a4f67]">{invoices.length} registro(s) en historial de usuario.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {invoices.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay facturas registradas todavia.</div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="advisor-card-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#162944]">{invoice.client_name}</p>
                      <p className="text-xs text-[#3a4f67]">{invoice.client_nif}</p>
                    </div>
                    <span className="advisor-chip">{invoice.status}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-4">
                    <p>Base: <strong>{formatAmount(invoice.amount_base)}</strong></p>
                    <p>IVA: <strong>{invoice.iva_rate}%</strong></p>
                    <p>IRPF: <strong>{invoice.irpf_retention}%</strong></p>
                    <p>Total: <strong>{formatAmount(invoice.total_amount)}</strong></p>
                  </div>
                  <p className="mt-2 text-xs text-[#3a4f67]">Fecha emision: {formatDate(invoice.issue_date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

