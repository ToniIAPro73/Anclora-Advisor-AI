"use client";

import { useMemo, useState } from "react";

export interface AdminDocumentRecord {
  id: string;
  title: string;
  category: string | null;
  created_at: string;
  doc_metadata?: {
    notebook_id?: string | null;
    notebook_title?: string | null;
    jurisdiction?: string | null;
    topic?: string | null;
    reason_for_fit?: string | null;
  } | null;
}

interface AdminKnowledgeWorkspaceProps {
  initialDocuments: AdminDocumentRecord[];
  initialDocumentCount: number;
  initialChunkCount: number;
}

interface StatusResponse {
  success: boolean;
  counts: {
    documents: number;
    chunks: number;
  };
  recentDocuments: AdminDocumentRecord[];
  recentJobs?: Array<{
    id: string;
    status: string;
    domain: string;
    notebook_title: string;
    source_count: number;
    documents_processed: number;
    chunks_inserted: number;
    replaced_documents: number;
    error_message: string | null;
    created_at: string;
  }>;
  error?: string;
}

interface ObservabilityResponse {
  success: boolean;
  summary?: {
    total: number;
    successRate: number;
    avgTotalMs: number;
    avgRetrievalMs: number;
    avgLlmMs: number;
    lowEvidenceRate: number;
    failedCount: number;
  };
  traces?: Array<{
    requestId: string;
    timestamp: string;
    success: boolean;
    queryLength: number;
    primarySpecialist: string | null;
    groundingConfidence: "high" | "medium" | "low" | "none" | null;
    citations: number;
    alerts: number;
    error: string | null;
    performance: {
      total_ms: number;
      retrieval_ms: number;
      llm_ms: number;
      llm_path: string;
      llm_model_used: string;
      tool_used: string | null;
    } | null;
  }>;
  error?: string;
}

interface IngestResponse {
  success: boolean;
  decision?: "GO" | "NO-GO";
  error?: string;
  code?: string;
  issues?: Array<{ code: string; message: string }>;
  result?: {
    documentsProcessed: number;
    chunksInserted: number;
    replacedDocuments: number;
  };
  jobId?: string;
  summary?: {
    sources: number;
    notebook_title: string;
    domain: string;
  };
}

type NotebookPreset = {
  domain: "fiscal" | "laboral" | "mercado";
  notebookTitle: string;
  notebookId: string;
};

const NOTEBOOK_PRESETS: Record<string, NotebookPreset> = {
  fiscal: {
    domain: "fiscal",
    notebookTitle: "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
    notebookId: "ee081687-f43c-4384-aea8-f4884f5c9a4f",
  },
  laboral: {
    domain: "laboral",
    notebookTitle: "ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL",
    notebookId: "60ee15f1-57b9-49c5-a229-9c8253d0b61b",
  },
  mercado: {
    domain: "mercado",
    notebookTitle: "ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO",
    notebookId: "411ac8f4-e24a-4a07-954c-da2571408b5d",
  },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminKnowledgeWorkspace({
  initialDocuments,
  initialDocumentCount,
  initialChunkCount,
}: AdminKnowledgeWorkspaceProps) {
  const [documents, setDocuments] = useState<AdminDocumentRecord[]>(initialDocuments);
  const [documentCount, setDocumentCount] = useState(initialDocumentCount);
  const [chunkCount, setChunkCount] = useState(initialChunkCount);
  const [domain, setDomain] = useState<"fiscal" | "laboral" | "mercado">("fiscal");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [reasonForFit, setReasonForFit] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(initialDocuments[0]?.id ?? null);
  const [jobs, setJobs] = useState<NonNullable<StatusResponse["recentJobs"]>>([]);
  const [traceSummary, setTraceSummary] = useState<ObservabilityResponse["summary"]>();
  const [traces, setTraces] = useState<NonNullable<ObservabilityResponse["traces"]>>([]);

  const notebookPreset = useMemo(() => NOTEBOOK_PRESETS[domain], [domain]);
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId]
  );

  async function refreshStatus(): Promise<void> {
    setRefreshing(true);
    setError(null);

    try {
      const [statusResponse, observabilityResponse] = await Promise.all([
        fetch("/api/admin/rag/status", { cache: "no-store" }),
        fetch("/api/admin/observability/rag", { cache: "no-store" }),
      ]);
      const statusResult = (await statusResponse.json()) as StatusResponse;
      const observabilityResult = (await observabilityResponse.json()) as ObservabilityResponse;
      if (!statusResponse.ok || !statusResult.success) {
        throw new Error(statusResult.error ?? "No se pudo refrescar el estado RAG");
      }
      if (!observabilityResponse.ok || !observabilityResult.success) {
        throw new Error(observabilityResult.error ?? "No se pudo refrescar la observabilidad RAG");
      }

      setDocuments(statusResult.recentDocuments ?? []);
      setDocumentCount(statusResult.counts.documents ?? 0);
      setChunkCount(statusResult.counts.chunks ?? 0);
      setJobs(statusResult.recentJobs ?? []);
      setTraceSummary(observabilityResult.summary);
      setTraces(observabilityResult.traces ?? []);
      setSelectedDocumentId((current) => current ?? statusResult.recentDocuments?.[0]?.id ?? null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Error al refrescar estado");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleIngest(event: React.FormEvent<HTMLFormElement>, dryRun: boolean): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_ref: "lvpplnqbyvscpuljnzqf",
          notebook_id: notebookPreset.notebookId,
          notebook_title: notebookPreset.notebookTitle,
          domain,
          dry_run: dryRun,
          replace_existing: true,
          sources: [
            {
              title: title.trim(),
              url: url.trim() || null,
              content: content.trim(),
              reason_for_fit: reasonForFit.trim(),
              source_type: url.trim() ? "web_page" : "generated_text",
            },
          ],
        }),
      });

      const result = (await response.json()) as IngestResponse;
      if (!response.ok || !result.success) {
        const issueText = result.issues?.map((issue) => issue.message).join(" | ");
        throw new Error(issueText || result.error || "No se pudo procesar la ingesta");
      }

      if (dryRun) {
        setMessage(`Dry-run OK para ${result.summary?.notebook_title ?? notebookPreset.notebookTitle}. Job ${result.jobId ?? "n/a"}.`);
        await refreshStatus();
        return;
      }

      setMessage(
        `Ingesta completada: ${result.result?.documentsProcessed ?? 0} documento(s), ${result.result?.chunksInserted ?? 0} chunk(s). Job ${result.jobId ?? "n/a"}.`
      );
      setTitle("");
      setUrl("");
      setReasonForFit("");
      setContent("");
      await refreshStatus();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error en ingesta admin");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDocument(documentId: string): Promise<void> {
    if (!window.confirm("Se eliminaran el documento y sus chunks asociados. Continuar?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/rag/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo eliminar el documento");
      }

      setMessage("Documento eliminado.");
      await refreshStatus();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar documento");
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="flex min-h-0 flex-col gap-4">
        <article className="advisor-card shrink-0 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="advisor-heading text-3xl text-[#162944]">Knowledge Base Admin</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#3a4f67]">
                Ingesta controlada por notebook, validacion de scope y estado operativo del inventario RAG.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={refreshing}
              className="advisor-btn border border-[#b8c8de] bg-white px-4 py-2 text-sm font-semibold text-[#162944] transition hover:bg-[#f3f7fd] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refrescando..." : "Refrescar estado"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Documentos</p>
              <p className="mt-1 text-2xl font-semibold text-[#162944]">{documentCount}</p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Chunks</p>
              <p className="mt-1 text-2xl font-semibold text-[#162944]">{chunkCount}</p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Notebook activo</p>
              <p className="mt-1 text-sm font-semibold text-[#162944]">{notebookPreset.notebookTitle}</p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Project ref</p>
              <p className="mt-1 text-sm font-semibold text-[#162944]">lvpplnqbyvscpuljnzqf</p>
            </div>
          </div>
        </article>

        <article className="advisor-card shrink-0 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">Observabilidad RAG</h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Trazas recientes de `/api/chat` y agregados de latencia.</p>
            </div>
            <span className="advisor-chip">{traceSummary?.total ?? 0} trace(s)</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Success rate</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">
                {traceSummary ? `${(traceSummary.successRate * 100).toFixed(0)}%` : "n/a"}
              </p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Avg total</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">
                {traceSummary ? `${Math.round(traceSummary.avgTotalMs)} ms` : "n/a"}
              </p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Avg retrieval</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">
                {traceSummary ? `${Math.round(traceSummary.avgRetrievalMs)} ms` : "n/a"}
              </p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Avg LLM</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">
                {traceSummary ? `${Math.round(traceSummary.avgLlmMs)} ms` : "n/a"}
              </p>
            </div>
            <div className="advisor-card-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Low evidence</p>
              <p className="mt-1 text-xl font-semibold text-[#162944]">
                {traceSummary ? `${(traceSummary.lowEvidenceRate * 100).toFixed(0)}%` : "n/a"}
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {traces.length === 0 && (
              <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
                Aun no hay trazas en memoria. Ejecuta consultas en el chat y pulsa "Refrescar estado".
              </div>
            )}

            {traces.map((trace) => (
              <div key={trace.requestId} className="advisor-card-muted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#162944]">{trace.primarySpecialist ?? "sin routing"}</p>
                    <p className="mt-1 text-xs text-[#3a4f67]">
                      {formatDateTime(trace.timestamp)} | query {trace.queryLength} chars
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        trace.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {trace.success ? "success" : "failed"}
                    </span>
                    {trace.groundingConfidence && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {trace.groundingConfidence}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] md:grid-cols-4">
                  <p>total: <strong>{trace.performance?.total_ms ?? 0} ms</strong></p>
                  <p>retrieval: <strong>{trace.performance?.retrieval_ms ?? 0} ms</strong></p>
                  <p>llm: <strong>{trace.performance?.llm_ms ?? 0} ms</strong></p>
                  <p>citas: <strong>{trace.citations}</strong></p>
                </div>
                {trace.performance && (
                  <p className="mt-2 text-xs text-[#3a4f67]">
                    path: <strong>{trace.performance.llm_path}</strong> | model: <strong>{trace.performance.llm_model_used}</strong>
                    {trace.performance.tool_used ? <> | tool: <strong>{trace.performance.tool_used}</strong></> : null}
                  </p>
                )}
                {trace.error && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {trace.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="advisor-card min-h-0 flex-1 overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d2dceb] px-5 py-4">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">Inventario indexado</h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Ultimos documentos disponibles para retrieval y verificacion.</p>
            </div>
            <span className="advisor-chip">Metadata visible</span>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-0 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay documentos disponibles.</div>
              ) : (
                <div className="space-y-3">
                  {documents.map((document) => {
                    const isSelected = document.id === selectedDocument?.id;
                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedDocumentId(document.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-[#1dab89]/40 bg-[#effaf6] shadow-sm"
                            : "border-[#d2dceb] bg-white hover:border-[#9eb6d5] hover:bg-[#f8fbff]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#162944]">{document.title}</p>
                            <p className="mt-1 text-xs text-[#3a4f67]">
                              {document.category ?? "sin categoria"} | {document.doc_metadata?.topic ?? "sin topic"}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[#3a4f67]">{formatDateTime(document.created_at)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto pr-1">
              {selectedDocument ? (
                <div className="advisor-card-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#162944]">{selectedDocument.title}</p>
                      <p className="mt-1 text-sm text-[#3a4f67]">
                        categoria: {selectedDocument.category ?? "sin categoria"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDocument(selectedDocument.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Metadata</p>
                    <div className="rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#162944]">
                      <p>Notebook ID: {selectedDocument.doc_metadata?.notebook_id ?? "sin notebook"}</p>
                      <p>Notebook title: {selectedDocument.doc_metadata?.notebook_title ?? "sin notebook_title"}</p>
                      <p>Jurisdiccion: {selectedDocument.doc_metadata?.jurisdiction ?? "sin jurisdiccion"}</p>
                      <p>Topic: {selectedDocument.doc_metadata?.topic ?? "sin topic"}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Reason for fit</p>
                    <div className="mt-2 rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#3a4f67]">
                      {selectedDocument.doc_metadata?.reason_for_fit ?? "No disponible en este documento."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">
                  Selecciona un documento para inspeccionar metadata y gestionar baja.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

      <aside className="advisor-card flex min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[#d2dceb] px-5 py-4">
          <h2 className="advisor-heading text-2xl text-[#162944]">Nueva ingesta</h2>
          <p className="mt-1 text-sm text-[#3a4f67]">Valida scope primero y ejecuta solo cuando el dry-run sea GO.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <form className="space-y-4" onSubmit={(event) => void handleIngest(event, false)}>
            <div>
              <label className="advisor-label" htmlFor="admin-domain">Dominio</label>
              <select
                id="admin-domain"
                className="advisor-input"
                value={domain}
                onChange={(event) => setDomain(event.target.value as "fiscal" | "laboral" | "mercado")}
              >
                <option value="fiscal">Fiscal</option>
                <option value="laboral">Laboral</option>
                <option value="mercado">Mercado</option>
              </select>
            </div>

            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Notebook destino</p>
              <p className="mt-1 text-sm font-semibold text-[#162944]">{notebookPreset.notebookTitle}</p>
              <p className="mt-1 break-all text-xs text-[#3a4f67]">{notebookPreset.notebookId}</p>
            </div>

            <div>
              <label className="advisor-label" htmlFor="admin-title">Titulo</label>
              <input
                id="admin-title"
                className="advisor-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Titulo de la fuente"
                required
              />
            </div>

            <div>
              <label className="advisor-label" htmlFor="admin-url">URL</label>
              <input
                id="admin-url"
                className="advisor-input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="advisor-label" htmlFor="admin-reason">Reason for fit</label>
              <textarea
                id="admin-reason"
                className="advisor-input min-h-28 resize-y"
                value={reasonForFit}
                onChange={(event) => setReasonForFit(event.target.value)}
                placeholder="Explica por que esta fuente encaja exactamente en el notebook."
                required
              />
            </div>

            <div>
              <label className="advisor-label" htmlFor="admin-content">Contenido</label>
              <textarea
                id="admin-content"
                className="advisor-input min-h-56 resize-y"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Pega aqui el contenido completo de la fuente..."
                required
              />
            </div>

            {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                onClick={(event) => void handleIngest(event as unknown as React.FormEvent<HTMLFormElement>, true)}
                className="rounded-xl border border-[#b8c8de] bg-white px-4 py-3 text-sm font-semibold text-[#162944] transition hover:bg-[#f3f7fd] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Procesando..." : "Dry-run"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#1dab89] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#169271] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Procesando..." : "Ejecutar ingesta"}
              </button>
            </div>
          </form>
          <div className="mt-6 border-t border-[#d2dceb] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="advisor-heading text-xl text-[#162944]">Jobs recientes</h3>
                <p className="mt-1 text-sm text-[#3a4f67]">Historial de validaciones e ingestas admin.</p>
              </div>
              <span className="advisor-chip">{jobs.length} job(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {jobs.length === 0 && (
                <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">No hay jobs registrados todavia.</div>
              )}

              {jobs.map((job) => (
                <div key={job.id} className="advisor-card-muted p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#162944]">{job.notebook_title}</p>
                      <p className="mt-1 text-xs text-[#3a4f67]">
                        {job.domain} | {job.source_count} source(s) | {formatDateTime(job.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        job.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : job.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : job.status === "running"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-3">
                    <p>docs: <strong>{job.documents_processed}</strong></p>
                    <p>chunks: <strong>{job.chunks_inserted}</strong></p>
                    <p>replaced: <strong>{job.replaced_documents}</strong></p>
                  </div>
                  {job.error_message && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {job.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
