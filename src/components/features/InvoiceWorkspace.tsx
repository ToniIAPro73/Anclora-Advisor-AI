"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditTimeline } from "@/components/features/AuditTimeline";
import type { AuditLogRecord } from "@/lib/audit/logs";
import {
  type InvoicePaymentRecord,
  invoiceTypeValues,
  invoiceStatusValues,
  type InvoiceRecord,
  type InvoiceStatus,
  type InvoiceType,
} from "@/lib/invoices/contracts";
import { buildInvoiceReference, getInvoiceTypeLabel } from "@/lib/invoices/service";

interface InvoiceWorkspaceProps {
  initialInvoices: InvoiceRecord[];
  initialAuditLogs: AuditLogRecord[];
  initialFilters?: Partial<InvoiceFilters>;
  initialSelectedInvoiceId?: string | null;
  initialPayments?: InvoicePaymentRecord[];
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
  paidAt: string;
  paymentMethod: string;
  paymentReference: string;
  paymentNotes: string;
};

type InvoiceFilterStatus = "all" | InvoiceStatus;
type InvoiceFilterType = "all" | InvoiceType;

type PaymentFormState = {
  amount: string;
  paidAt: string;
  paymentMethod: string;
  paymentReference: string;
  notes: string;
};

type InvoiceFilters = {
  q: string;
  status: InvoiceFilterStatus;
  invoiceType: InvoiceFilterType;
  series: string;
  dateFrom: string;
  dateTo: string;
};

type InvoiceBookRow = {
  period: string;
  total: number;
  count: number;
  paid: number;
  issued: number;
  draft: number;
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
  paidAt: "",
  paymentMethod: "",
  paymentReference: "",
  paymentNotes: "",
};

const INITIAL_FILTERS: InvoiceFilters = {
  q: "",
  status: "all",
  invoiceType: "all",
  series: "",
  dateFrom: "",
  dateTo: "",
};

const INITIAL_PAYMENT_FORM: PaymentFormState = {
  amount: "",
  paidAt: TODAY,
  paymentMethod: "transferencia",
  paymentReference: "",
  notes: "",
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInvoicePeriod(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    month: "short",
    year: "numeric",
  }).format(new Date(date));
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
    paidAt: invoice.paid_at ? invoice.paid_at.slice(0, 10) : "",
    paymentMethod: invoice.payment_method ?? "",
    paymentReference: invoice.payment_reference ?? "",
    paymentNotes: invoice.payment_notes ?? "",
  };
}

export function InvoiceWorkspace({
  initialInvoices,
  initialAuditLogs,
  initialFilters,
  initialSelectedInvoiceId,
  initialPayments = [],
}: InvoiceWorkspaceProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [payments, setPayments] = useState<InvoicePaymentRecord[]>(initialPayments);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [form, setForm] = useState<InvoiceFormState>(INITIAL_FORM);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(INITIAL_PAYMENT_FORM);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({ ...INITIAL_FILTERS, ...initialFilters });
  const [submitting, setSubmitting] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [submittingPaymentInvoiceId, setSubmittingPaymentInvoiceId] = useState<string | null>(null);
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
  const rectificativeCount = useMemo(
    () => invoices.filter((invoice) => invoice.invoice_type === "rectificative").length,
    [invoices]
  );
  const totalVolume = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
    [invoices]
  );
  const paidVolume = useMemo(
    () => invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
    [invoices]
  );
  const pendingCollectionVolume = useMemo(
    () => invoices.filter((invoice) => invoice.status !== "paid").reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
    [invoices]
  );

  const queuedDeliveries = useMemo(() => emailOutbox.filter((item) => item.status === "queued").length, [emailOutbox]);
  const invoiceBook = useMemo<InvoiceBookRow[]>(() => {
    const groups = new Map<string, InvoiceBookRow>();
    for (const invoice of invoices) {
      const period = getInvoicePeriod(invoice.issue_date);
      const current = groups.get(period) ?? {
        period,
        total: 0,
        count: 0,
        paid: 0,
        issued: 0,
        draft: 0,
      };
      current.total += Number(invoice.total_amount);
      current.count += 1;
      current.paid += invoice.status === "paid" ? 1 : 0;
      current.issued += invoice.status === "issued" ? 1 : 0;
      current.draft += invoice.status === "draft" ? 1 : 0;
      groups.set(period, current);
    }
    return Array.from(groups.values());
  }, [invoices]);
  const paymentsByInvoiceId = useMemo(() => {
    const grouped = new Map<string, InvoicePaymentRecord[]>();
    for (const payment of payments) {
      const current = grouped.get(payment.invoice_id) ?? [];
      current.push(payment);
      grouped.set(payment.invoice_id, current);
    }
    return grouped;
  }, [payments]);
  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === (editingInvoiceId ?? initialSelectedInvoiceId)) ?? null,
    [editingInvoiceId, initialSelectedInvoiceId, invoices]
  );
  const selectedInvoicePayments = useMemo(
    () => (selectedInvoice ? paymentsByInvoiceId.get(selectedInvoice.id) ?? [] : []),
    [paymentsByInvoiceId, selectedInvoice]
  );

  function getCollectedAmount(invoiceId: string): number {
    return (paymentsByInvoiceId.get(invoiceId) ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  function getOutstandingAmount(invoice: InvoiceRecord): number {
    return Math.max(0, Number(invoice.total_amount) - getCollectedAmount(invoice.id));
  }

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

  useEffect(() => {
    if (!initialSelectedInvoiceId) {
      return;
    }
    const invoice = initialInvoices.find((item) => item.id === initialSelectedInvoiceId);
    if (invoice) {
      startEditing(invoice);
    }
  }, [initialInvoices, initialSelectedInvoiceId]);

  async function refreshInvoices(nextFilters: InvoiceFilters = filters) {
    try {
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
      if (nextFilters.status !== "all") params.set("status", nextFilters.status);
      if (nextFilters.invoiceType !== "all") params.set("invoiceType", nextFilters.invoiceType);
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
    setPaymentForm(INITIAL_PAYMENT_FORM);
    setEditingInvoiceId(null);
  }

  function startEditing(invoice: InvoiceRecord) {
    setForm(toFormState(invoice));
    setPaymentForm({
      amount: getOutstandingAmount(invoice).toFixed(2),
      paidAt: TODAY,
      paymentMethod: invoice.payment_method ?? "transferencia",
      paymentReference: invoice.payment_reference ?? "",
      notes: "",
    });
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
          paidAt: form.paidAt ? new Date(`${form.paidAt}T12:00:00.000Z`).toISOString() : undefined,
          paymentMethod: form.paymentMethod.trim() || undefined,
          paymentReference: form.paymentReference.trim() || undefined,
          paymentNotes: form.paymentNotes.trim() || undefined,
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

  async function handleCreatePayment(invoice: InvoiceRecord) {
    setSubmittingPaymentInvoiceId(invoice.id);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: toNumber(paymentForm.amount),
          paidAt: new Date(`${paymentForm.paidAt}T12:00:00.000Z`).toISOString(),
          paymentMethod: paymentForm.paymentMethod.trim(),
          paymentReference: paymentForm.paymentReference.trim() || undefined,
          notes: paymentForm.notes.trim() || undefined,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        payment?: InvoicePaymentRecord;
        invoice?: InvoiceRecord;
      };

      if (!response.ok || !result.success || !result.invoice || !result.payment) {
        throw new Error(result.error ?? "No se pudo registrar el cobro");
      }

      upsertInvoice(result.invoice);
      setPayments((current) => [result.payment as InvoicePaymentRecord, ...current]);
      const nextCollectedAmount = getCollectedAmount(invoice.id) + Number(result.payment.amount);
      const nextOutstandingAmount = Math.max(0, Number(result.invoice.total_amount) - nextCollectedAmount);
      setPaymentForm((current) => ({
        ...current,
        amount: nextOutstandingAmount.toFixed(2),
        paymentReference: "",
        notes: "",
      }));
      setOkMessage("Cobro registrado correctamente.");
      await refreshAuditLogs();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Error al registrar cobro");
    } finally {
      setSubmittingPaymentInvoiceId(null);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/invoice-payments/${paymentId}`, { method: "DELETE" });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoice?: InvoiceRecord;
      };
      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo eliminar el cobro");
      }

      setPayments((current) => current.filter((payment) => payment.id !== paymentId));
      upsertInvoice(result.invoice);
      setOkMessage("Cobro eliminado.");
      await refreshAuditLogs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar cobro");
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

  async function handleDuplicate(invoiceId: string) {
    setUpdatingInvoiceId(invoiceId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/duplicate`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        invoice?: InvoiceRecord;
      };
      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo duplicar la factura");
      }
      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshAuditLogs();
      setOkMessage("Factura duplicada como nuevo borrador.");
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Error al duplicar factura");
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  async function handleExport(format: "csv" | "json") {
    setError(null);
    setOkMessage(null);
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.invoiceType !== "all") params.set("invoiceType", filters.invoiceType);
      if (filters.series.trim()) params.set("series", filters.series.trim().toUpperCase());
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      params.set("format", format);
      params.set("limit", "500");

      const response = await fetch(`/api/invoices/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("No se pudo exportar el libro de facturas");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `facturas-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setOkMessage(`Libro exportado en formato ${format.toUpperCase()}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error al exportar facturas");
    }
  }

  function openPrintableView(invoiceId: string) {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function handleRectify(invoiceId: string) {
    const reason = window.prompt("Motivo de la rectificativa:", "Rectificacion operativa");
    if (!reason) {
      return;
    }

    setUpdatingInvoiceId(invoiceId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/rectify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = (await response.json()) as { success: boolean; error?: string; invoice?: InvoiceRecord };
      if (!response.ok || !result.success || !result.invoice) {
        throw new Error(result.error ?? "No se pudo crear la rectificativa");
      }
      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshAuditLogs();
      setOkMessage("Factura rectificativa creada.");
    } catch (rectifyError) {
      setError(rectifyError instanceof Error ? rectifyError.message : "Error al crear rectificativa");
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
                <label className="advisor-label" htmlFor="paymentMethod">Metodo de cobro</label>
                <input
                  id="paymentMethod"
                  className="advisor-input"
                  value={form.paymentMethod}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                  placeholder="transferencia, bizum..."
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="paidAt">Fecha de cobro</label>
                <input
                  id="paidAt"
                  type="date"
                  className="advisor-input"
                  value={form.paidAt}
                  onChange={(event) => setForm((current) => ({ ...current, paidAt: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="paymentReference">Referencia de cobro</label>
              <input
                id="paymentReference"
                className="advisor-input"
                value={form.paymentReference}
                onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))}
                placeholder="Operacion bancaria o referencia interna"
              />
            </div>
            <div>
              <label className="advisor-label" htmlFor="paymentNotes">Notas de cobro</label>
              <textarea
                id="paymentNotes"
                className="advisor-input min-h-20 resize-y"
                value={form.paymentNotes}
                onChange={(event) => setForm((current) => ({ ...current, paymentNotes: event.target.value }))}
                placeholder="Incidencias, fraccionamiento o detalle de conciliacion"
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

          {selectedInvoice && (
            <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cobros parciales</p>
                  <p className="mt-1 text-sm font-semibold text-[#162944]">
                    {buildInvoiceReference(selectedInvoice.series, selectedInvoice.invoice_number)}
                  </p>
                  <p className="mt-1 text-xs text-[#3a4f67]">
                    Cobrado {formatAmount(getCollectedAmount(selectedInvoice.id))} · Pendiente {formatAmount(getOutstandingAmount(selectedInvoice))}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  className="advisor-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Importe cobrado"
                />
                <input
                  className="advisor-input"
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))}
                />
                <input
                  className="advisor-input"
                  value={paymentForm.paymentMethod}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                  placeholder="Metodo de cobro"
                />
                <input
                  className="advisor-input"
                  value={paymentForm.paymentReference}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentReference: event.target.value }))}
                  placeholder="Referencia"
                />
              </div>
              <textarea
                className="advisor-input mt-3 min-h-20 resize-y"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Notas del cobro"
              />
              <button
                type="button"
                disabled={submittingPaymentInvoiceId === selectedInvoice.id}
                className="advisor-btn mt-3 advisor-btn-primary advisor-btn-full"
                onClick={() => void handleCreatePayment(selectedInvoice)}
              >
                {submittingPaymentInvoiceId === selectedInvoice.id ? "Registrando cobro..." : "Registrar cobro parcial"}
              </button>
              <div className="mt-3 space-y-2">
                {selectedInvoicePayments.length === 0 ? (
                  <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                    Sin cobros registrados para esta factura.
                  </div>
                ) : (
                  selectedInvoicePayments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-3 text-xs text-[#3a4f67]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#162944]">{formatAmount(Number(payment.amount))}</p>
                        <button
                          type="button"
                          className="text-red-700 hover:underline"
                          onClick={() => void handleDeletePayment(payment.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                      <p className="mt-1">{formatDateTime(payment.paid_at)} · {payment.payment_method ?? "sin metodo"}</p>
                      {payment.payment_reference && <p className="mt-1">Ref {payment.payment_reference}</p>}
                      {payment.notes && <p className="mt-1">{payment.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </article>

        <article className="advisor-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Resumen de facturacion</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
              <p>Borradores: <strong className="text-[#162944]">{draftCount}</strong></p>
              <p className="mt-1">Emitidas: <strong className="text-[#162944]">{issuedCount}</strong></p>
              <p className="mt-1">Pagadas: <strong className="text-[#162944]">{paidCount}</strong></p>
              <p className="mt-1">Rectificativas: <strong className="text-[#162944]">{rectificativeCount}</strong></p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Volumen total</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(totalVolume)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">Suma de importes totales del historial visible.</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cobrado</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(paidVolume)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">Importe conciliado como pagado.</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Pendiente de cobro</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(pendingCollectionVolume)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">Importe aun no conciliado.</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Libro de facturas</p>
                <p className="mt-1 text-sm text-[#162944]">{invoiceBook.length} periodo(s) visibles</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                  onClick={() => void handleExport("csv")}
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                  onClick={() => void handleExport("json")}
                >
                  Exportar JSON
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {invoiceBook.length === 0 ? (
                <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  No hay periodos visibles para el filtro actual.
                </div>
              ) : (
                invoiceBook.map((row) => (
                  <div key={row.period} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-3 text-xs text-[#3a4f67]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#162944]">{row.period}</p>
                      <p className="font-semibold text-[#162944]">{formatAmount(row.total)}</p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <p>Total: <strong className="text-[#162944]">{row.count}</strong></p>
                      <p>Borrador: <strong className="text-[#162944]">{row.draft}</strong></p>
                      <p>Emitida: <strong className="text-[#162944]">{row.issued}</strong></p>
                      <p>Pagada: <strong className="text-[#162944]">{row.paid}</strong></p>
                    </div>
                  </div>
                ))
              )}
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
              <select
                id="invoiceTypeFilter"
                className="advisor-input min-w-32"
                value={filters.invoiceType}
                onChange={(event) => setFilters((current) => ({ ...current, invoiceType: event.target.value as InvoiceFilterType }))}
              >
                <option value="all">Todas</option>
                {invoiceTypeValues.map((invoiceType) => (
                  <option key={invoiceType} value={invoiceType}>{getInvoiceTypeLabel(invoiceType)}</option>
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
                const isSelected = (editingInvoiceId ?? initialSelectedInvoiceId) === invoice.id;
                const collectedAmount = getCollectedAmount(invoice.id);
                const outstandingAmount = getOutstandingAmount(invoice);
                return (
                  <div key={invoice.id} className={`advisor-card-muted p-3 ${isSelected ? "ring-2 ring-[#1dab89] ring-offset-2 ring-offset-white" : ""}`}>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">
                        {getInvoiceTypeLabel(invoice.invoice_type)}
                      </span>
                      {invoice.rectifies_invoice_id && (
                        <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">
                          Rectifica {invoice.rectifies_invoice_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-4">
                      <p>Base: <strong>{formatAmount(Number(invoice.amount_base))}</strong></p>
                      <p>IVA: <strong>{invoice.iva_rate}%</strong></p>
                      <p>IRPF: <strong>{invoice.irpf_retention}%</strong></p>
                      <p>Total: <strong>{formatAmount(Number(invoice.total_amount))}</strong></p>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-2">
                      <p>Cobrado: <strong>{formatAmount(collectedAmount)}</strong></p>
                      <p>Pendiente: <strong>{formatAmount(outstandingAmount)}</strong></p>
                    </div>
                    <p className="mt-2 text-xs text-[#3a4f67]">Fecha emision: {formatDate(invoice.issue_date)}</p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Email: <strong>{invoice.recipient_email ?? "Sin definir"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Enviada: <strong>{invoice.sent_at ? formatDate(invoice.sent_at) : "No"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Cobrada: <strong>{invoice.paid_at ? formatDate(invoice.paid_at) : "No"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Metodo: <strong>{invoice.payment_method ?? "Sin registrar"}</strong>
                      {invoice.payment_reference ? ` · Ref ${invoice.payment_reference}` : ""}
                    </p>
                    {invoice.payment_notes && (
                      <p className="mt-1 text-xs text-[#3a4f67]">
                        Cobro: <strong>{invoice.payment_notes}</strong>
                      </p>
                    )}
                    {invoice.rectification_reason && (
                      <p className="mt-1 text-xs text-[#3a4f67]">
                        Rectificacion: <strong>{invoice.rectification_reason}</strong>
                      </p>
                    )}
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
                        disabled={isBusy}
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => void handleDuplicate(invoice.id)}
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => openPrintableView(invoice.id)}
                      >
                        Vista PDF
                      </button>
                      {invoice.invoice_type !== "rectificative" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                          onClick={() => void handleRectify(invoice.id)}
                        >
                          Rectificar
                        </button>
                      )}
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
                          onClick={() => startEditing(invoice)}
                        >
                          Cobros
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
