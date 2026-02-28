"use client";

import type {
  AdminDocumentRecord,
  AdminIngestJobRecord,
  HardwareBaselineSummary,
  HardwareBenchmarkSummary,
  HardwareRuntimeGateSummary,
  NotebookPreset,
  ObservabilityResponse,
  ObservabilityTraceRecord,
} from "./admin-knowledge-types";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getJobStatusClass(status: string): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "running") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="advisor-card-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#162944]">{value}</p>
    </div>
  );
}

export function AdminHeaderPanel({
  documentCount,
  chunkCount,
  notebookTitle,
  refreshing,
  autoRefreshEnabled,
  autoRefreshIntervalSec,
  onAutoRefreshEnabledChange,
  onAutoRefreshIntervalChange,
  onRefresh,
}: {
  documentCount: number;
  chunkCount: number;
  notebookTitle: string;
  refreshing: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalSec: 15 | 30 | 60;
  onAutoRefreshEnabledChange: (enabled: boolean) => void;
  onAutoRefreshIntervalChange: (value: 15 | 30 | 60) => void;
  onRefresh: () => void;
}) {
  return (
    <article className="advisor-card shrink-0 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="advisor-heading text-3xl text-[#162944]">Knowledge Base Admin</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#3a4f67]">
            Ingesta controlada por notebook, validacion de scope y estado operativo del inventario RAG.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[#d2dceb] bg-white px-3 py-2 text-xs font-semibold text-[#162944]">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(event) => onAutoRefreshEnabledChange(event.target.checked)}
            />
            auto-refresh
          </label>
          <select
            className="rounded-xl border border-[#d2dceb] bg-white px-3 py-2 text-xs font-semibold text-[#162944]"
            value={autoRefreshIntervalSec}
            onChange={(event) => onAutoRefreshIntervalChange(Number(event.target.value) as 15 | 30 | 60)}
            disabled={!autoRefreshEnabled}
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="advisor-btn border border-[#b8c8de] bg-white px-4 py-2 text-sm font-semibold text-[#162944] transition hover:bg-[#f3f7fd] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refrescando..." : "Refrescar estado"}
          </button>
        </div>
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
          <p className="mt-1 text-sm font-semibold text-[#162944]">{notebookTitle}</p>
        </div>
        <div className="advisor-card-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Project ref</p>
          <p className="mt-1 text-sm font-semibold text-[#162944]">lvpplnqbyvscpuljnzqf</p>
        </div>
      </div>
    </article>
  );
}

export function AdminObservabilityPanel({
  summary,
  traces,
}: {
  summary?: ObservabilityResponse["summary"];
  traces: ObservabilityTraceRecord[];
}) {
  return (
    <article className="advisor-card shrink-0 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="advisor-heading text-2xl text-[#162944]">Observabilidad RAG</h2>
          <p className="mt-1 text-sm text-[#3a4f67]">Trazas recientes de `/api/chat` y agregados de latencia.</p>
        </div>
        <span className="advisor-chip">{summary?.total ?? 0} trace(s)</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Success rate" value={summary ? `${(summary.successRate * 100).toFixed(0)}%` : "n/a"} />
        <MetricCard label="Avg total" value={summary ? `${Math.round(summary.avgTotalMs)} ms` : "n/a"} />
        <MetricCard label="Avg retrieval" value={summary ? `${Math.round(summary.avgRetrievalMs)} ms` : "n/a"} />
        <MetricCard label="Avg LLM" value={summary ? `${Math.round(summary.avgLlmMs)} ms` : "n/a"} />
        <MetricCard label="Low evidence" value={summary ? `${(summary.lowEvidenceRate * 100).toFixed(0)}%` : "n/a"} />
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
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{trace.error}</div>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export function AdminHardwarePanel({
  runtimeGate,
  baseline,
  benchmark,
}: {
  runtimeGate?: HardwareRuntimeGateSummary | null;
  baseline?: HardwareBaselineSummary | null;
  benchmark?: HardwareBenchmarkSummary | null;
}) {
  return (
    <article className="advisor-card shrink-0 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="advisor-heading text-2xl text-[#162944]">Runtime hardware</h2>
          <p className="mt-1 text-sm text-[#3a4f67]">
            Estado del benchmark local, decision de runtime y baseline de modelos Ollama.
          </p>
        </div>
        <span className="advisor-chip">{benchmark?.comparison_mode ?? "sin datos"}</span>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="advisor-card-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Runtime gate</p>
          <p className="mt-1 text-lg font-semibold text-[#162944]">{runtimeGate?.decision ?? "sin datos"}</p>
          <p className="mt-2 text-sm text-[#3a4f67]">{runtimeGate?.recommended_profile ?? "sin perfil recomendado"}</p>
          <p className="mt-2 text-xs text-[#3a4f67]">{runtimeGate?.reason ?? "Ejecuta los benchmarks para poblar esta vista."}</p>
        </div>

        <div className="advisor-card-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Baseline models</p>
          <p className="mt-1 text-lg font-semibold text-[#162944]">{baseline?.decision ?? "sin datos"}</p>
          <div className="mt-3 space-y-2 text-xs text-[#3a4f67]">
            {(baseline?.checks ?? []).slice(0, 4).map((check) => (
              <p key={`${check.role}-${check.model}`}>
                {check.role}: <strong>{check.model}</strong>
                {check.quantization_level ? <> ({check.quantization_level})</> : null}
              </p>
            ))}
            {(baseline?.checks ?? []).length === 0 && <p>Sin validacion ejecutada.</p>}
          </div>
        </div>

        <div className="advisor-card-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Benchmark summary</p>
          <div className="mt-3 space-y-2 text-xs text-[#3a4f67]">
            {(benchmark?.profiles ?? []).slice(0, 3).map((profile) => (
              <div key={profile.profile}>
                <p className="font-semibold text-[#162944]">{profile.profile}</p>
                <p>chat avg: {profile.avg_chat_latency_ms !== null ? `${Math.round(profile.avg_chat_latency_ms)} ms` : "n/a"}</p>
                <p>embed avg: {profile.avg_embedding_latency_ms !== null ? `${Math.round(profile.avg_embedding_latency_ms)} ms` : "n/a"}</p>
                <p className="truncate">models: {profile.configured_chat_models.join(", ")}</p>
              </div>
            ))}
            {(benchmark?.profiles ?? []).length === 0 && <p>Sin benchmark ejecutado.</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

export function AdminInventoryPanel({
  documents,
  totalDocuments,
  domainFilter,
  topicFilter,
  search,
  page,
  selectedDocument,
  onDomainFilterChange,
  onTopicFilterChange,
  onSearchChange,
  onPageChange,
  onSelectDocument,
  onDeleteDocument,
}: {
  documents: AdminDocumentRecord[];
  totalDocuments: number;
  domainFilter: "all" | "fiscal" | "laboral" | "mercado";
  topicFilter: string;
  search: string;
  page: number;
  selectedDocument: AdminDocumentRecord | null;
  onDomainFilterChange: (value: "all" | "fiscal" | "laboral" | "mercado") => void;
  onTopicFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelectDocument: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
}) {
  const pageSize = 50;
  const currentStart = totalDocuments === 0 ? 0 : page * pageSize + 1;
  const currentEnd = totalDocuments === 0 ? 0 : page * pageSize + documents.length;
  const canGoPrev = page > 0;
  const canGoNext = documents.length === pageSize && currentEnd < totalDocuments;

  return (
    <article className="advisor-card min-h-0 flex-1 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d2dceb] px-5 py-4">
        <div>
          <h2 className="advisor-heading text-2xl text-[#162944]">Inventario indexado</h2>
          <p className="mt-1 text-sm text-[#3a4f67]">Ultimos documentos disponibles para retrieval y verificacion.</p>
        </div>
        <span className="advisor-chip">
          {currentStart}-{currentEnd} / {totalDocuments}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="mb-3 grid gap-3">
            <select
              className="advisor-input"
              value={domainFilter}
              onChange={(event) => onDomainFilterChange(event.target.value as "all" | "fiscal" | "laboral" | "mercado")}
            >
              <option value="all">Todos los dominios</option>
              <option value="fiscal">Fiscal</option>
              <option value="laboral">Laboral</option>
              <option value="mercado">Mercado</option>
            </select>
            <input
              className="advisor-input"
              value={topicFilter}
              onChange={(event) => onTopicFilterChange(event.target.value)}
              placeholder="Filtrar por topic"
            />
            <input
              className="advisor-input"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por titulo, notebook o reason_for_fit"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#d2dceb] bg-white px-3 py-2 text-xs font-semibold text-[#162944] disabled:opacity-50"
                disabled={!canGoPrev}
                onClick={() => onPageChange(page - 1)}
              >
                Anterior
              </button>
              <span className="text-xs font-semibold text-[#3a4f67]">Pagina {page + 1}</span>
              <button
                type="button"
                className="rounded-xl border border-[#d2dceb] bg-white px-3 py-2 text-xs font-semibold text-[#162944] disabled:opacity-50"
                disabled={!canGoNext}
                onClick={() => onPageChange(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
          {documents.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay documentos que coincidan con los filtros actuales.</div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => {
                const isSelected = document.id === selectedDocument?.id;
                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => onSelectDocument(document.id)}
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
                  <p className="mt-1 text-sm text-[#3a4f67]">categoria: {selectedDocument.category ?? "sin categoria"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteDocument(selectedDocument.id)}
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
  );
}

export function AdminIngestSidebar({
  domain,
  notebookPreset,
  title,
  url,
  reasonForFit,
  content,
  submitting,
  message,
  error,
  jobs,
  onDomainChange,
  onTitleChange,
  onUrlChange,
  onReasonForFitChange,
  onContentChange,
  onDryRun,
  onSubmit,
}: {
  domain: "fiscal" | "laboral" | "mercado";
  notebookPreset: NotebookPreset;
  title: string;
  url: string;
  reasonForFit: string;
  content: string;
  submitting: boolean;
  message: string | null;
  error: string | null;
  jobs: AdminIngestJobRecord[];
  onDomainChange: (domain: "fiscal" | "laboral" | "mercado") => void;
  onTitleChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onReasonForFitChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onDryRun: (event: React.FormEvent<HTMLFormElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <aside className="advisor-card flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[#d2dceb] px-5 py-4">
        <h2 className="advisor-heading text-2xl text-[#162944]">Nueva ingesta</h2>
        <p className="mt-1 text-sm text-[#3a4f67]">Valida scope primero y ejecuta solo cuando el dry-run sea GO.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="advisor-label" htmlFor="admin-domain">Dominio</label>
            <select
              id="admin-domain"
              className="advisor-input"
              value={domain}
              onChange={(event) => onDomainChange(event.target.value as "fiscal" | "laboral" | "mercado")}
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
              onChange={(event) => onTitleChange(event.target.value)}
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
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="advisor-label" htmlFor="admin-reason">Reason for fit</label>
            <textarea
              id="admin-reason"
              className="advisor-input min-h-28 resize-y"
              value={reasonForFit}
              onChange={(event) => onReasonForFitChange(event.target.value)}
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
              onChange={(event) => onContentChange(event.target.value)}
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
              onClick={(event) => onDryRun(event as unknown as React.FormEvent<HTMLFormElement>)}
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getJobStatusClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-3">
                  <p>docs: <strong>{job.documents_processed}</strong></p>
                  <p>chunks: <strong>{job.chunks_inserted}</strong></p>
                  <p>replaced: <strong>{job.replaced_documents}</strong></p>
                </div>
                {job.error_message && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{job.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
