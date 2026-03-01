"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditTimeline } from "@/components/features/AuditTimeline";
import type { AuditLogRecord } from "@/lib/audit/logs";
import {
  invoiceStatusValues,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoices/contracts";
import { buildInvoiceReference } from "@/lib/invoices/service";

interface InvoiceWorkspaceProps {
  initialInvoices: InvoiceRecord[];
  initialAuditLogs: AuditLogRecord[];
}

type InvoiceFormState = {
  clientName: string;
  clientNif: string;
  amountBase: string;
  ivaRate: string;
  irpfRetention: string;
  issueDate: string;
  series: string;
  recipientEmail: string;
};

type InvoiceFilterStatus = "all" | InvoiceStatus;

type InvoiceFilters = {
  q: string;
  status: InvoiceFilterStatus;
  series: string;
  dateFrom: string;
  dateTo: string;
};

type SendInvoiceResponse = {
  success: boolean;
  error?: string;
  invoice?: InvoiceRecord;
  delivery?: {
    jobId: string;
    outboxId: string;
    status: "queued";
    mode: "queue";
  };
};

type OperationJobRecord = {
  id: string;
  job_kind: string;
  status: string;
  created_at: string;
  error_message: string | null;
};

type EmailOutboxRecord = {
  id: string;
  status: string;
  recipient_email: string;
  sent_at: string | null;
  created_at: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

const INITIAL_FORM: InvoiceFormState = {
  clientName: "",
  clientNif: "",
  amountBase: "1000",
  ivaRate: "21",
  irpfRetention: "15",
  issueDate: TODAY,
  series: TODAY.slice(0, 4),
  recipientEmail: "",
};

const INITIAL_FILTERS: InvoiceFilters = {
  q: "",
  status: "all",
  series: "",
  dateFrom: "",
  dateTo: "",
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
    series: invoice.series ?? invoice.issue_date.slice(0, 4),
    recipientEmail: invoice.recipient_email ?? "",
  };
}

export function InvoiceWorkspace({ initialInvoices, initialAuditLogs }: InvoiceWorkspaceProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [form, setForm] = useState<InvoiceFormState>(INITIAL_FORM);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>(INITIAL_FILTERS);
  const [submitting, setSubmitting] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [operationJobs, setOperationJobs] = useState<OperationJobRecord[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<EmailOutboxRecord[]>([]);

  const previewTotal = useMemo(() => {
    const base = toNumber(form.amountBase);
    const iva = toNumber(form.ivaRate);
    const irpf = toNumber(form.irpfRetention);
    return round2(base + (base * iva) / 100 - (base * irpf) / 100);
  }, [form.amountBase, form.ivaRate, form.irpfRetention]);

  const filteredInvoices = invoices;

  const draftCount = useMemo(() => invoices.filter((invoice) => invoice.status === "draft").length, [invoices]);
  const issuedCount = useMemo(() => invoices.filter((invoice) => invoice.status === "issued").length, [invoices]);
  const paidCount = useMemo(() => invoices.filter((invoice) => invoice.status === "paid").length, [invoices]);
  const totalVolume = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
    [invoices]
  );

  const queuedDeliveries = useMemo(() => emailOutbox.filter((item) => item.status === "queued").length, [emailOutbox]);

  async function refreshAuditLogs() {
    try {
      const response = await fetch("/api/audit-logs?domain=invoices&limit=8", { cache: "no-store" });
      const result = (await response.json()) as { success: boolean; logs?: AuditLogRecord[] };
      if (response.ok && result.success && result.logs) {
        setAuditLogs(result.logs);
      }
    } catch {
      // Ignore audit refresh errors in UI.
    }
  }

  async function refreshOperations() {
    try {
      const response = await fetch("/api/operations/jobs", { cache: "no-store" });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        jobs?: OperationJobRecord[];
        emailOutbox?: EmailOutboxRecord[];
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo cargar la cola operativa");
      }

      setOperationJobs(result.jobs ?? []);
      setEmailOutbox(result.emailOutbox ?? []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Error al cargar la cola operativa");
    }
  }

  useEffect(() => {
    void refreshOperations();
  }, []);

  async function refreshInvoices(nextFilters: InvoiceFilters = filters) {
    try {
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
      if (nextFilters.status !== "all") params.set("status", nextFilters.status);
      if (nextFilters.series.trim()) params.set("series", nextFilters.series.trim().toUpperCase());
      if (nextFilters.dateFrom) params.set("dateFrom", nextFilters.dateFrom);
      if (nextFilters.dateTo) params.set("dateTo", nextFilters.dateTo);
      params.set("limit", "100");
      const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoices?: InvoiceRecord[];
      };
      if (!response.ok || !result.success || !result.invoices) {
        throw new Error(result.error ?? "No se pudieron cargar las facturas");
      }
      setInvoices(result.invoices);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Error al cargar facturas");
    }
  }

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

  function upsertInvoice(savedInvoice: InvoiceRecord) {
    setInvoices((previous) => {
      const next = previous.some((item) => item.id === savedInvoice.id)
        ? previous.map((item) => (item.id === savedInvoice.id ? savedInvoice : item))
        : [savedInvoice, ...previous];
      return [...next].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 60);
    });
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
          series: form.series.trim().toUpperCase(),
          recipientEmail: form.recipientEmail.trim() || undefined,
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

      upsertInvoice(result.invoice);
      setOkMessage(isEditing ? "Factura actualizada." : "Factura guardada en borrador.");
      resetForm();
      await refreshInvoices();
      await refreshAuditLogs();
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

      upsertInvoice(result.invoice);
      setOkMessage(`Factura marcada como ${status}.`);
      await refreshInvoices();
      await refreshAuditLogs();
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
      await refreshInvoices();
      await refreshAuditLogs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar factura");
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  async function handleSend(invoice: InvoiceRecord) {
    const fallbackEmail = invoice.recipient_email ?? form.recipientEmail;
    const recipientEmail = window.prompt(
      "Introduce el email de destino para preparar el envio:",
      fallbackEmail
    );

    if (!recipientEmail) {
      return;
    }

    setUpdatingInvoiceId(invoice.id);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail }),
      });
      const result = (await response.json()) as SendInvoiceResponse;

      if (!response.ok || !result.success || !result.invoice || !result.delivery) {
        throw new Error(result.error ?? "No se pudo preparar el envio");
      }

      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshOperations();
      setOkMessage(`Factura encolada para envio. Job ${result.delivery.jobId}.`);
      await refreshAuditLogs();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Error al preparar el envio");
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  async function handleProcessQueue() {
    setProcessingQueue(true);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch("/api/operations/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        result?: {
          claimed: number;
          completed: number;
          failed: number;
        };
      };

      if (!response.ok || !result.success || !result.result) {
        throw new Error(result.error ?? "No se pudo procesar la cola");
      }

      await Promise.all([refreshOperations()]);
      setOkMessage(
        `Cola procesada: ${result.result.claimed} job(s), ${result.result.completed} completado(s), ${result.result.failed} fallido(s).`
      );
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Error al procesar la cola");
    } finally {
      setProcessingQueue(false);
    }
  }

  function openPrintableView(invoiceId: string) {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");
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
              <p className="mt-1 text-sm text-[#3a4f67]">
                Alta, edicion, numeracion por serie y envio sin salir del dashboard.
              </p>
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
                <label className="advisor-label" htmlFor="series">Serie</label>
                <input
                  id="series"
                  className="advisor-input"
                  maxLength={20}
                  value={form.series}
                  onChange={(event) => setForm((current) => ({ ...current, series: event.target.value.toUpperCase() }))}
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      issueDate: event.target.value,
                      series: current.series ? current.series : event.target.value.slice(0, 4),
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="recipientEmail">Email destinatario</label>
              <input
                id="recipientEmail"
                type="email"
                className="advisor-input"
                value={form.recipientEmail}
                onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
                placeholder="cliente@empresa.com"
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
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cola operativa</p>
                <p className="mt-1 text-sm text-[#162944]">{queuedDeliveries} envio(s) pendiente(s)</p>
              </div>
              <button
                type="button"
                disabled={processingQueue}
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={() => void handleProcessQueue()}
              >
                {processingQueue ? "Procesando..." : "Procesar cola"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {operationJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  <p>
                    <strong>{job.job_kind}</strong> · {job.status}
                  </p>
                  <p className="mt-1">{formatDate(job.created_at)}</p>
                  {job.error_message && <p className="mt-1 text-red-700">{job.error_message}</p>}
                </div>
              ))}
              {operationJobs.length === 0 && (
                <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  Sin jobs operativos registrados.
                </div>
              )}
            </div>
          </div>
        </article>

        <AuditTimeline title="Auditoria de facturacion" logs={auditLogs} />
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">Facturas recientes</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">
                {filteredInvoices.length} visible(s) de {invoices.length} registro(s).
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input className="advisor-input min-w-32" placeholder="Cliente o NIF" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
              <input className="advisor-input min-w-24" placeholder="Serie" value={filters.series} onChange={(event) => setFilters((current) => ({ ...current, series: event.target.value.toUpperCase() }))} />
              <input type="date" className="advisor-input min-w-28" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
              <input type="date" className="advisor-input min-w-28" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
              <select
                id="invoiceStatusFilter"
                className="advisor-input min-w-32"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as InvoiceFilterStatus }))}
              >
                <option value="all">Todos</option>
                {invoiceStatusValues.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <div className="flex gap-2 lg:col-span-5">
                <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void refreshInvoices()}>
                  Aplicar filtros
                </button>
                <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setFilters(INITIAL_FILTERS); void refreshInvoices(INITIAL_FILTERS); }}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredInvoices.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">
              No hay facturas para el filtro seleccionado.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => {
                const isBusy = updatingInvoiceId === invoice.id;
                const reference = buildInvoiceReference(invoice.series, invoice.invoice_number);
                return (
                  <div key={invoice.id} className="advisor-card-muted p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#162944]">{invoice.client_name}</p>
                        <p className="text-xs text-[#3a4f67]">{invoice.client_nif}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">
                          {reference}
                        </p>
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
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Email: <strong>{invoice.recipient_email ?? "Sin definir"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Enviada: <strong>{invoice.sent_at ? formatDate(invoice.sent_at) : "No"}</strong>
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => startEditing(invoice)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => openPrintableView(invoice.id)}
                      >
                        Vista PDF
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleSend(invoice)}
                      >
                        Enviar
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
