"use client";

import { useMemo, useState } from "react";
import {
  invoiceStatusValues,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoices/contracts";

interface InvoiceWorkspaceProps {
  initialInvoices: InvoiceRecord[];
}

type InvoiceFormState = {
  clientName: string;
  clientNif: string;
  amountBase: string;
  ivaRate: string;
  irpfRetention: string;
  issueDate: string;
};

type InvoiceFilterStatus = "all" | InvoiceStatus;

const INITIAL_FORM: InvoiceFormState = {
  clientName: "",
  clientNif: "",
  amountBase: "1000",
  ivaRate: "21",
  irpfRetention: "15",
  issueDate: new Date().toISOString().slice(0, 10),
};

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

function getStatusClass(status: string): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "issued") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function toFormState(invoice: InvoiceRecord): InvoiceFormState {
  return {
    clientName: invoice.client_name,
    clientNif: invoice.client_nif,
    amountBase: Number(invoice.amount_base).toFixed(2),
    ivaRate: Number(invoice.iva_rate).toFixed(2),
    irpfRetention: Number(invoice.irpf_retention).toFixed(2),
    issueDate: invoice.issue_date,
  };
}

export function InvoiceWorkspace({ initialInvoices }: InvoiceWorkspaceProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [form, setForm] = useState<InvoiceFormState>(INITIAL_FORM);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<InvoiceFilterStatus>("all");
  const [submitting, setSubmitting] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    const base = toNumber(form.amountBase);
    const iva = toNumber(form.ivaRate);
    const irpf = toNumber(form.irpfRetention);
    return round2(base + (base * iva) / 100 - (base * irpf) / 100);
  }, [form.amountBase, form.ivaRate, form.irpfRetention]);

  const filteredInvoices = useMemo(() => {
    if (filterStatus === "all") {
      return invoices;
    }
    return invoices.filter((invoice) => invoice.status === filterStatus);
  }, [filterStatus, invoices]);

  const draftCount = useMemo(() => invoices.filter((invoice) => invoice.status === "draft").length, [invoices]);
  const issuedCount = useMemo(() => invoices.filter((invoice) => invoice.status === "issued").length, [invoices]);
  const paidCount = useMemo(() => invoices.filter((invoice) => invoice.status === "paid").length, [invoices]);
  const totalVolume = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
    [invoices]
  );

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingInvoiceId(null);
  }

  function startEditing(invoice: InvoiceRecord) {
    setForm(toFormState(invoice));
    setEditingInvoiceId(invoice.id);
    setError(null);
    setOkMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      const isEditing = Boolean(editingInvoiceId);
      const response = await fetch(isEditing ? `/api/invoices/${editingInvoiceId}` : "/api/invoices", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName.trim(),
          clientNif: form.clientNif.trim().toUpperCase(),
          amountBase: toNumber(form.amountBase),
          ivaRate: toNumber(form.ivaRate),
          irpfRetention: toNumber(form.irpfRetention),
          issueDate: form.issueDate,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoice?: InvoiceRecord;
      };

      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo guardar la factura");
      }

      const savedInvoice = result.invoice;
      setInvoices((previous) => {
        const next = isEditing
          ? previous.map((item) => (item.id === savedInvoice.id ? savedInvoice : item))
          : [savedInvoice, ...previous];
        return [...next].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 60);
      });
      setOkMessage(isEditing ? "Factura actualizada." : "Factura guardada en borrador.");
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar factura");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(invoiceId: string, status: InvoiceStatus) {
    setUpdatingInvoiceId(invoiceId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoice?: InvoiceRecord;
      };

      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo actualizar el estado");
      }

      const savedInvoice = result.invoice;
      setInvoices((previous) => previous.map((item) => (item.id === savedInvoice.id ? savedInvoice : item)));
      setOkMessage(`Factura marcada como ${status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar factura");
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  async function handleDelete(invoiceId: string) {
    if (!window.confirm("Se eliminara la factura. Esta accion no se puede deshacer.")) {
      return;
    }

    setUpdatingInvoiceId(invoiceId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      const result = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo eliminar la factura");
      }

      setInvoices((previous) => previous.filter((invoice) => invoice.id !== invoiceId));
      if (editingInvoiceId === invoiceId) {
        resetForm();
      }
      setOkMessage("Factura eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar factura");
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
        <article className="advisor-card shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {editingInvoiceId ? "Editar factura" : "Nueva factura"}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Alta, edicion y cambio de estado sin salir del dashboard.</p>
            </div>
            {editingInvoiceId && (
              <button
                type="button"
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="advisor-label" htmlFor="clientName">Cliente</label>
              <input
                id="clientName"
                className="advisor-input"
                value={form.clientName}
                onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="advisor-label" htmlFor="clientNif">NIF/CIF</label>
              <input
                id="clientNif"
                className="advisor-input"
                value={form.clientNif}
                onChange={(event) => setForm((current) => ({ ...current, clientNif: event.target.value }))}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="amountBase">Base imponible</label>
                <input
                  id="amountBase"
                  type="number"
                  step="0.01"
                  min="0"
                  className="advisor-input"
                  value={form.amountBase}
                  onChange={(event) => setForm((current) => ({ ...current, amountBase: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="issueDate">Fecha de emision</label>
                <input
                  id="issueDate"
                  type="date"
                  className="advisor-input"
                  value={form.issueDate}
                  onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="ivaRate">IVA %</label>
                <input
                  id="ivaRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="advisor-input"
                  value={form.ivaRate}
                  onChange={(event) => setForm((current) => ({ ...current, ivaRate: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="irpfRetention">Retencion IRPF %</label>
                <input
                  id="irpfRetention"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="advisor-input"
                  value={form.irpfRetention}
                  onChange={(event) => setForm((current) => ({ ...current, irpfRetention: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Total estimado</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(previewTotal)}</p>
            </div>

            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}

            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? "Guardando..." : editingInvoiceId ? "Actualizar factura" : "Guardar borrador"}
            </button>
          </form>
        </article>

        <article className="advisor-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Resumen de facturacion</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
              <p>Borradores: <strong className="text-[#162944]">{draftCount}</strong></p>
              <p className="mt-1">Emitidas: <strong className="text-[#162944]">{issuedCount}</strong></p>
              <p className="mt-1">Pagadas: <strong className="text-[#162944]">{paidCount}</strong></p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Volumen total</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(totalVolume)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">Suma de importes totales del historial visible.</p>
            </div>
          </div>
        </article>
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">Facturas recientes</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">{filteredInvoices.length} visible(s) de {invoices.length} registro(s).</p>
            </div>
            <div>
              <label className="advisor-label" htmlFor="invoiceStatusFilter">Filtro de estado</label>
              <select
                id="invoiceStatusFilter"
                className="advisor-input min-w-40"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as InvoiceFilterStatus)}
              >
                <option value="all">Todos</option>
                {invoiceStatusValues.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredInvoices.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay facturas para el filtro seleccionado.</div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => {
                const isBusy = updatingInvoiceId === invoice.id;
                return (
                  <div key={invoice.id} className="advisor-card-muted p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#162944]">{invoice.client_name}</p>
                        <p className="text-xs text-[#3a4f67]">{invoice.client_nif}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-4">
                      <p>Base: <strong>{formatAmount(Number(invoice.amount_base))}</strong></p>
                      <p>IVA: <strong>{invoice.iva_rate}%</strong></p>
                      <p>IRPF: <strong>{invoice.irpf_retention}%</strong></p>
                      <p>Total: <strong>{formatAmount(Number(invoice.total_amount))}</strong></p>
                    </div>
                    <p className="mt-2 text-xs text-[#3a4f67]">Fecha emision: {formatDate(invoice.issue_date)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => startEditing(invoice)}
                      >
                        Editar
                      </button>
                      {invoice.status === "draft" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(invoice.id, "issued")}
                        >
                          Emitir
                        </button>
                      )}
                      {invoice.status !== "paid" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(invoice.id, "paid")}
                        >
                          Marcar pagada
                        </button>
                      )}
                      {invoice.status !== "draft" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(invoice.id, "draft")}
                        >
                          Volver a borrador
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
