"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditTimeline } from "@/components/features/AuditTimeline";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
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

function formatDate(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatAmount(value: number, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInvoicePeriod(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusClass(status: string): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "issued") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getInvoiceStatusLabel(status: InvoiceStatus | string, locale: "es" | "en"): string {
  if (status === "issued") return locale === "en" ? "Issued" : "Emitida";
  if (status === "paid") return locale === "en" ? "Paid" : "Pagada";
  return locale === "en" ? "Draft" : "Borrador";
}

function getOperationJobStatusLabel(status: string, locale: "es" | "en"): string {
  if (status === "completed") return locale === "en" ? "Completed" : "Completado";
  if (status === "failed") return locale === "en" ? "Failed" : "Fallido";
  if (status === "running") return locale === "en" ? "Running" : "En ejecucion";
  if (status === "queued") return locale === "en" ? "Queued" : "En cola";
  return status;
}

function getInvoiceTypeLabelLocalized(invoiceType: InvoiceType | string | null | undefined, locale: "es" | "en"): string {
  if (invoiceType === "rectificative") return locale === "en" ? "Rectificative" : "Rectificativa";
  if (invoiceType === "standard") return locale === "en" ? "Standard" : "Ordinaria";
  return invoiceType ? getInvoiceTypeLabel(invoiceType as InvoiceType) : (locale === "en" ? "Undefined" : "Sin definir");
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
  const { locale } = useAppPreferences();
  const isEn = locale === "en";
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [payments, setPayments] = useState<InvoicePaymentRecord[]>(initialPayments);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [form, setForm] = useState<InvoiceFormState>(INITIAL_FORM);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    ...INITIAL_PAYMENT_FORM,
    paymentMethod: isEn ? "wire transfer" : INITIAL_PAYMENT_FORM.paymentMethod,
  });
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
      const period = getInvoicePeriod(invoice.issue_date, locale);
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
        throw new Error(result.error ?? (isEn ? "Could not load the operations queue" : "No se pudo cargar la cola operativa"));
      }

      setOperationJobs(result.jobs ?? []);
      setEmailOutbox(result.emailOutbox ?? []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : (isEn ? "Error loading the operations queue" : "Error al cargar la cola operativa"));
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
        throw new Error(result.error ?? (isEn ? "Could not load invoices" : "No se pudieron cargar las facturas"));
      }
      setInvoices(result.invoices);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : (isEn ? "Error loading invoices" : "Error al cargar facturas"));
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setPaymentForm({
      ...INITIAL_PAYMENT_FORM,
      paymentMethod: isEn ? "wire transfer" : INITIAL_PAYMENT_FORM.paymentMethod,
    });
    setEditingInvoiceId(null);
  }

  function startEditing(invoice: InvoiceRecord) {
    setForm(toFormState(invoice));
    setPaymentForm({
      amount: getOutstandingAmount(invoice).toFixed(2),
      paidAt: TODAY,
      paymentMethod: invoice.payment_method ?? (isEn ? "wire transfer" : "transferencia"),
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
        throw new Error(result.error ?? (isEn ? "Could not save the invoice" : "No se pudo guardar la factura"));
      }

      upsertInvoice(result.invoice);
      setOkMessage(isEditing ? (isEn ? "Invoice updated." : "Factura actualizada.") : (isEn ? "Invoice saved as draft." : "Factura guardada en borrador."));
      resetForm();
      await refreshInvoices();
      await refreshAuditLogs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (isEn ? "Error saving invoice" : "Error al guardar factura"));
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
        throw new Error(result.error ?? (isEn ? "Could not update the status" : "No se pudo actualizar el estado"));
      }

      upsertInvoice(result.invoice);
      setOkMessage(isEn ? `Invoice marked as ${getInvoiceStatusLabel(status, locale).toLowerCase()}.` : `Factura marcada como ${status}.`);
      await refreshInvoices();
      await refreshAuditLogs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : (isEn ? "Error updating invoice" : "Error al actualizar factura"));
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
        throw new Error(result.error ?? (isEn ? "Could not register the payment" : "No se pudo registrar el cobro"));
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
      setOkMessage(isEn ? "Payment registered successfully." : "Cobro registrado correctamente.");
      await refreshAuditLogs();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : (isEn ? "Error registering payment" : "Error al registrar cobro"));
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
        throw new Error(result.error ?? (isEn ? "Could not delete the payment" : "No se pudo eliminar el cobro"));
      }

      setPayments((current) => current.filter((payment) => payment.id !== paymentId));
      upsertInvoice(result.invoice);
      setOkMessage(isEn ? "Payment deleted." : "Cobro eliminado.");
      await refreshAuditLogs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : (isEn ? "Error deleting payment" : "Error al eliminar cobro"));
    }
  }

  async function handleDelete(invoiceId: string) {
    if (!window.confirm(isEn ? "The invoice will be deleted. This action cannot be undone." : "Se eliminara la factura. Esta accion no se puede deshacer.")) {
      return;
    }

    setUpdatingInvoiceId(invoiceId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      const result = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? (isEn ? "Could not delete the invoice" : "No se pudo eliminar la factura"));
      }

      setInvoices((previous) => previous.filter((invoice) => invoice.id !== invoiceId));
      if (editingInvoiceId === invoiceId) {
        resetForm();
      }
      setOkMessage(isEn ? "Invoice deleted." : "Factura eliminada.");
      await refreshInvoices();
      await refreshAuditLogs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : (isEn ? "Error deleting invoice" : "Error al eliminar factura"));
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  async function handleSend(invoice: InvoiceRecord) {
    const fallbackEmail = invoice.recipient_email ?? form.recipientEmail;
    const recipientEmail = window.prompt(
      isEn ? "Enter the destination email to prepare the delivery:" : "Introduce el email de destino para preparar el envio:",
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
        throw new Error(result.error ?? (isEn ? "Could not prepare the delivery" : "No se pudo preparar el envio"));
      }

      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshOperations();
      setOkMessage(isEn ? `Invoice queued for delivery. Job ${result.delivery.jobId}.` : `Factura encolada para envio. Job ${result.delivery.jobId}.`);
      await refreshAuditLogs();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : (isEn ? "Error preparing the delivery" : "Error al preparar el envio"));
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
        throw new Error(result.error ?? (isEn ? "Could not process the queue" : "No se pudo procesar la cola"));
      }

      await Promise.all([refreshOperations()]);
      setOkMessage(
        isEn
          ? `Queue processed: ${result.result.claimed} job(s), ${result.result.completed} completed, ${result.result.failed} failed.`
          : `Cola procesada: ${result.result.claimed} job(s), ${result.result.completed} completado(s), ${result.result.failed} fallido(s).`
      );
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : (isEn ? "Error processing the queue" : "Error al procesar la cola"));
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
        throw new Error(result.error ?? (isEn ? "Could not duplicate the invoice" : "No se pudo duplicar la factura"));
      }
      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshAuditLogs();
      setOkMessage(isEn ? "Invoice duplicated as a new draft." : "Factura duplicada como nuevo borrador.");
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : (isEn ? "Error duplicating invoice" : "Error al duplicar factura"));
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
        throw new Error(isEn ? "Could not export the invoice book" : "No se pudo exportar el libro de facturas");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${isEn ? "invoices" : "facturas"}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setOkMessage(isEn ? `Invoice book exported as ${format.toUpperCase()}.` : `Libro exportado en formato ${format.toUpperCase()}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : (isEn ? "Error exporting invoices" : "Error al exportar facturas"));
    }
  }

  function openPrintableView(invoiceId: string) {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function handleRectify(invoiceId: string) {
    const reason = window.prompt(
      isEn ? "Reason for the rectificative invoice:" : "Motivo de la rectificativa:",
      isEn ? "Operational rectification" : "Rectificacion operativa"
    );
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
        throw new Error(result.error ?? (isEn ? "Could not create the rectificative invoice" : "No se pudo crear la rectificativa"));
      }
      upsertInvoice(result.invoice);
      await refreshInvoices();
      await refreshAuditLogs();
      setOkMessage(isEn ? "Rectificative invoice created." : "Factura rectificativa creada.");
    } catch (rectifyError) {
      setError(rectifyError instanceof Error ? rectifyError.message : (isEn ? "Error creating rectificative invoice" : "Error al crear rectificativa"));
    } finally {
      setUpdatingInvoiceId(null);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pr-1 lg:col-span-2">
        <article className="advisor-card shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {isEn ? (editingInvoiceId ? "Edit invoice" : "New invoice") : (editingInvoiceId ? "Editar factura" : "Nueva factura")}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">
                {isEn
                  ? "Create, edit, number by series, and send invoices without leaving the dashboard."
                  : "Alta, edicion, numeracion por serie y envio sin salir del dashboard."}
              </p>
            </div>
            {editingInvoiceId && (
              <button
                type="button"
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={resetForm}
              >
                {isEn ? "Cancel" : "Cancelar"}
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="advisor-label" htmlFor="clientName">{isEn ? "Client" : "Cliente"}</label>
              <input
                id="clientName"
                className="advisor-input"
                value={form.clientName}
                onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="advisor-label" htmlFor="clientNif">{isEn ? "Tax ID" : "NIF/CIF"}</label>
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
                <label className="advisor-label" htmlFor="series">{isEn ? "Series" : "Serie"}</label>
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
                <label className="advisor-label" htmlFor="issueDate">{isEn ? "Issue date" : "Fecha de emision"}</label>
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
              <label className="advisor-label" htmlFor="recipientEmail">{isEn ? "Recipient email" : "Email destinatario"}</label>
              <input
                id="recipientEmail"
                type="email"
                className="advisor-input"
                value={form.recipientEmail}
                onChange={(event) => setForm((current) => ({ ...current, recipientEmail: event.target.value }))}
                placeholder={isEn ? "client@company.com" : "cliente@empresa.com"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="paymentMethod">{isEn ? "Payment method" : "Metodo de cobro"}</label>
                <input
                  id="paymentMethod"
                  className="advisor-input"
                  value={form.paymentMethod}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                  placeholder={isEn ? "wire transfer, bizum..." : "transferencia, bizum..."}
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="paidAt">{isEn ? "Payment date" : "Fecha de cobro"}</label>
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
              <label className="advisor-label" htmlFor="paymentReference">{isEn ? "Payment reference" : "Referencia de cobro"}</label>
              <input
                id="paymentReference"
                className="advisor-input"
                value={form.paymentReference}
                onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))}
                placeholder={isEn ? "Bank operation or internal reference" : "Operacion bancaria o referencia interna"}
              />
            </div>
            <div>
              <label className="advisor-label" htmlFor="paymentNotes">{isEn ? "Payment notes" : "Notas de cobro"}</label>
              <textarea
                id="paymentNotes"
                className="advisor-input min-h-20 resize-y"
                value={form.paymentNotes}
                onChange={(event) => setForm((current) => ({ ...current, paymentNotes: event.target.value }))}
                placeholder={isEn ? "Issues, installments, or reconciliation detail" : "Incidencias, fraccionamiento o detalle de conciliacion"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="amountBase">{isEn ? "Tax base" : "Base imponible"}</label>
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
                <label className="advisor-label" htmlFor="ivaRate">{isEn ? "VAT %" : "IVA %"}</label>
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
              <label className="advisor-label" htmlFor="irpfRetention">{isEn ? "Income tax withholding %" : "Retencion IRPF %"}</label>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Estimated total" : "Total estimado"}</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(previewTotal, locale)}</p>
            </div>

            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}

            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? (isEn ? "Saving..." : "Guardando...") : editingInvoiceId ? (isEn ? "Update invoice" : "Actualizar factura") : (isEn ? "Save draft" : "Guardar borrador")}
            </button>
          </form>

          {selectedInvoice && (
            <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Partial payments" : "Cobros parciales"}</p>
                  <p className="mt-1 text-sm font-semibold text-[#162944]">
                    {buildInvoiceReference(selectedInvoice.series, selectedInvoice.invoice_number)}
                  </p>
                  <p className="mt-1 text-xs text-[#3a4f67]">
                    {isEn ? "Collected" : "Cobrado"} {formatAmount(getCollectedAmount(selectedInvoice.id), locale)} · {isEn ? "Outstanding" : "Pendiente"} {formatAmount(getOutstandingAmount(selectedInvoice), locale)}
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
                  placeholder={isEn ? "Collected amount" : "Importe cobrado"}
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
                  placeholder={isEn ? "Payment method" : "Metodo de cobro"}
                />
                <input
                  className="advisor-input"
                  value={paymentForm.paymentReference}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentReference: event.target.value }))}
                  placeholder={isEn ? "Reference" : "Referencia"}
                />
              </div>
              <textarea
                className="advisor-input mt-3 min-h-20 resize-y"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder={isEn ? "Payment notes" : "Notas del cobro"}
              />
              <button
                type="button"
                disabled={submittingPaymentInvoiceId === selectedInvoice.id}
                className="advisor-btn mt-3 advisor-btn-primary advisor-btn-full"
                onClick={() => void handleCreatePayment(selectedInvoice)}
              >
                {submittingPaymentInvoiceId === selectedInvoice.id ? (isEn ? "Registering payment..." : "Registrando cobro...") : (isEn ? "Register partial payment" : "Registrar cobro parcial")}
              </button>
              <div className="mt-3 space-y-2">
                {selectedInvoicePayments.length === 0 ? (
                  <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                    {isEn ? "No payments recorded for this invoice." : "Sin cobros registrados para esta factura."}
                  </div>
                ) : (
                  selectedInvoicePayments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-3 text-xs text-[#3a4f67]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#162944]">{formatAmount(Number(payment.amount), locale)}</p>
                        <button
                          type="button"
                          className="text-red-700 hover:underline"
                          onClick={() => void handleDeletePayment(payment.id)}
                        >
                          {isEn ? "Delete" : "Eliminar"}
                        </button>
                      </div>
                      <p className="mt-1">{formatDateTime(payment.paid_at, locale)} · {payment.payment_method ?? (isEn ? "no method" : "sin metodo")}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Invoicing summary" : "Resumen de facturacion"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
              <p>{isEn ? "Drafts" : "Borradores"}: <strong className="text-[#162944]">{draftCount}</strong></p>
              <p className="mt-1">{isEn ? "Issued" : "Emitidas"}: <strong className="text-[#162944]">{issuedCount}</strong></p>
              <p className="mt-1">{isEn ? "Paid" : "Pagadas"}: <strong className="text-[#162944]">{paidCount}</strong></p>
              <p className="mt-1">{isEn ? "Rectificative" : "Rectificativas"}: <strong className="text-[#162944]">{rectificativeCount}</strong></p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Total volume" : "Volumen total"}</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(totalVolume, locale)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Sum of total amounts in the visible history." : "Suma de importes totales del historial visible."}</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Collected" : "Cobrado"}</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(paidVolume, locale)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Amount reconciled as paid." : "Importe conciliado como pagado."}</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Outstanding" : "Pendiente de cobro"}</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">{formatAmount(pendingCollectionVolume, locale)}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Amount not yet reconciled." : "Importe aun no conciliado."}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Invoice book" : "Libro de facturas"}</p>
                <p className="mt-1 text-sm text-[#162944]">{invoiceBook.length} {isEn ? "visible period(s)" : "periodo(s) visibles"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                  onClick={() => void handleExport("csv")}
                >
                  {isEn ? "Export CSV" : "Exportar CSV"}
                </button>
                <button
                  type="button"
                  className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                  onClick={() => void handleExport("json")}
                >
                  {isEn ? "Export JSON" : "Exportar JSON"}
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {invoiceBook.length === 0 ? (
                <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  {isEn ? "No visible periods for the current filter." : "No hay periodos visibles para el filtro actual."}
                </div>
              ) : (
                invoiceBook.map((row) => (
                  <div key={row.period} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-3 text-xs text-[#3a4f67]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#162944]">{row.period}</p>
                      <p className="font-semibold text-[#162944]">{formatAmount(row.total, locale)}</p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <p>{isEn ? "Total" : "Total"}: <strong className="text-[#162944]">{row.count}</strong></p>
                      <p>{isEn ? "Draft" : "Borrador"}: <strong className="text-[#162944]">{row.draft}</strong></p>
                      <p>{isEn ? "Issued" : "Emitida"}: <strong className="text-[#162944]">{row.issued}</strong></p>
                      <p>{isEn ? "Paid" : "Pagada"}: <strong className="text-[#162944]">{row.paid}</strong></p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Operations queue" : "Cola operativa"}</p>
                <p className="mt-1 text-sm text-[#162944]">{queuedDeliveries} {isEn ? "pending delivery(ies)" : "envio(s) pendiente(s)"}</p>
              </div>
              <button
                type="button"
                disabled={processingQueue}
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={() => void handleProcessQueue()}
              >
                {processingQueue ? (isEn ? "Processing..." : "Procesando...") : (isEn ? "Process queue" : "Procesar cola")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {operationJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  <p>
                    <strong>{job.job_kind}</strong> · {getOperationJobStatusLabel(job.status, locale)}
                  </p>
                  <p className="mt-1">{formatDate(job.created_at, locale)}</p>
                  {job.error_message && <p className="mt-1 text-red-700">{job.error_message}</p>}
                </div>
              ))}
              {operationJobs.length === 0 && (
                <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  {isEn ? "No operational jobs recorded." : "Sin jobs operativos registrados."}
                </div>
              )}
            </div>
          </div>
        </article>

        <AuditTimeline title={isEn ? "Invoicing audit" : "Auditoria de facturacion"} logs={auditLogs} />
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="space-y-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">{isEn ? "Recent invoices" : "Facturas recientes"}</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">
                {isEn
                  ? `${filteredInvoices.length} visible item(s) out of ${invoices.length} record(s).`
                  : `${filteredInvoices.length} visible(s) de ${invoices.length} registro(s).`}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <input className="advisor-input min-w-0 w-full" placeholder={isEn ? "Client/Tax ID" : "Cliente/NIF"} value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
              <input className="advisor-input min-w-0 w-full" placeholder={isEn ? "Series" : "Serie"} value={filters.series} onChange={(event) => setFilters((current) => ({ ...current, series: event.target.value.toUpperCase() }))} />
              <input type="date" className="advisor-input min-w-0 w-full" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
              <input type="date" className="advisor-input min-w-0 w-full" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
              <select
                id="invoiceStatusFilter"
                className="advisor-input min-w-0 w-full"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as InvoiceFilterStatus }))}
              >
                <option value="all">{isEn ? "Status" : "Estado"}</option>
                {invoiceStatusValues.map((status) => (
                  <option key={status} value={status}>{getInvoiceStatusLabel(status, locale)}</option>
                ))}
              </select>
              <select
                id="invoiceTypeFilter"
                className="advisor-input min-w-0 w-full"
                value={filters.invoiceType}
                onChange={(event) => setFilters((current) => ({ ...current, invoiceType: event.target.value as InvoiceFilterType }))}
              >
                <option value="all">{isEn ? "Type" : "Tipo"}</option>
                {invoiceTypeValues.map((invoiceType) => (
                  <option key={invoiceType} value={invoiceType}>{getInvoiceTypeLabelLocalized(invoiceType, locale)}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">
                <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void refreshInvoices()}>
                  {isEn ? "Apply filters" : "Aplicar filtros"}
                </button>
                <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setFilters(INITIAL_FILTERS); void refreshInvoices(INITIAL_FILTERS); }}>
                  {isEn ? "Clear" : "Limpiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredInvoices.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">
              {isEn ? "No invoices for the selected filter." : "No hay facturas para el filtro seleccionado."}
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
                        <p className="break-words text-sm font-semibold text-[#162944]">{invoice.client_name}</p>
                        <p className="break-words text-xs text-[#3a4f67]">{invoice.client_nif}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">
                          {reference}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(invoice.status)}`}>
                        {getInvoiceStatusLabel(invoice.status, locale)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">
                        {getInvoiceTypeLabelLocalized(invoice.invoice_type, locale)}
                      </span>
                      {invoice.rectifies_invoice_id && (
                        <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">
                          <span className="break-all">{isEn ? "Rectifies" : "Rectifica"} {invoice.rectifies_invoice_id.slice(0, 8)}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-4">
                      <p>{isEn ? "Base" : "Base"}: <strong>{formatAmount(Number(invoice.amount_base), locale)}</strong></p>
                      <p>{isEn ? "VAT" : "IVA"}: <strong>{invoice.iva_rate}%</strong></p>
                      <p>{isEn ? "Income tax" : "IRPF"}: <strong>{invoice.irpf_retention}%</strong></p>
                      <p>{isEn ? "Total" : "Total"}: <strong>{formatAmount(Number(invoice.total_amount), locale)}</strong></p>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-2">
                      <p>{isEn ? "Collected" : "Cobrado"}: <strong>{formatAmount(collectedAmount, locale)}</strong></p>
                      <p>{isEn ? "Outstanding" : "Pendiente"}: <strong>{formatAmount(outstandingAmount, locale)}</strong></p>
                    </div>
                    <p className="mt-2 text-xs text-[#3a4f67]">{isEn ? "Issue date" : "Fecha emision"}: {formatDate(invoice.issue_date, locale)}</p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      Email: <strong className="break-words">{invoice.recipient_email ?? (isEn ? "Undefined" : "Sin definir")}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      {isEn ? "Sent" : "Enviada"}: <strong>{invoice.sent_at ? formatDate(invoice.sent_at, locale) : (isEn ? "No" : "No")}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      {isEn ? "Paid" : "Cobrada"}: <strong>{invoice.paid_at ? formatDate(invoice.paid_at, locale) : (isEn ? "No" : "No")}</strong>
                    </p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      {isEn ? "Method" : "Metodo"}: <strong className="break-words">{invoice.payment_method ?? (isEn ? "Not recorded" : "Sin registrar")}</strong>
                      {invoice.payment_reference ? ` · Ref ${invoice.payment_reference}` : ""}
                    </p>
                    {invoice.payment_notes && (
                      <p className="mt-1 text-xs text-[#3a4f67]">
                        {isEn ? "Payment" : "Cobro"}: <strong className="break-words">{invoice.payment_notes}</strong>
                      </p>
                    )}
                    {invoice.rectification_reason && (
                      <p className="mt-1 text-xs text-[#3a4f67]">
                        {isEn ? "Rectification" : "Rectificacion"}: <strong className="break-words">{invoice.rectification_reason}</strong>
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => startEditing(invoice)}
                      >
                        {isEn ? "Edit" : "Editar"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => void handleDuplicate(invoice.id)}
                      >
                        {isEn ? "Duplicate" : "Duplicar"}
                      </button>
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => openPrintableView(invoice.id)}
                      >
                        {isEn ? "PDF view" : "Vista PDF"}
                      </button>
                      {invoice.invoice_type !== "rectificative" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                          onClick={() => void handleRectify(invoice.id)}
                        >
                          {isEn ? "Rectify" : "Rectificar"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleSend(invoice)}
                      >
                        {isEn ? "Send" : "Enviar"}
                      </button>
                      {invoice.status === "draft" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(invoice.id, "issued")}
                        >
                          {isEn ? "Issue" : "Emitir"}
                        </button>
                      )}
                      {invoice.status !== "paid" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => startEditing(invoice)}
                        >
                          {isEn ? "Payments" : "Cobros"}
                        </button>
                      )}
                      {invoice.status !== "draft" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(invoice.id, "draft")}
                        >
                          {isEn ? "Back to draft" : "Volver a borrador"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        {isEn ? "Delete" : "Eliminar"}
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
