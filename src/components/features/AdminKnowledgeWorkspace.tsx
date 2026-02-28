"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminHardwarePanel,
  AdminHeaderPanel,
  AdminIngestSidebar,
  AdminInventoryPanel,
  AdminObservabilityPanel,
} from "./admin/AdminKnowledgePanels";
import type {
  AdminDocumentRecord,
  IngestResponse,
  NotebookPreset,
  ObservabilityResponse,
  StatusResponse,
} from "./admin/admin-knowledge-types";

export type { AdminDocumentRecord } from "./admin/admin-knowledge-types";

interface AdminKnowledgeWorkspaceProps {
  initialDocuments: AdminDocumentRecord[];
  initialDocumentCount: number;
  initialChunkCount: number;
}

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
  const [hardware, setHardware] = useState<ObservabilityResponse["hardware"]>();

  const notebookPreset = useMemo(() => NOTEBOOK_PRESETS[domain], [domain]);
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId]
  );

  useEffect(() => {
    void refreshStatus();
  }, []);

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
      setHardware(observabilityResult.hardware);
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
        <AdminHeaderPanel
          documentCount={documentCount}
          chunkCount={chunkCount}
          notebookTitle={notebookPreset.notebookTitle}
          refreshing={refreshing}
          onRefresh={() => void refreshStatus()}
        />
        <AdminObservabilityPanel summary={traceSummary} traces={traces} />
        <AdminHardwarePanel
          runtimeGate={hardware?.runtimeGate}
          baseline={hardware?.baseline}
          benchmark={hardware?.benchmark}
        />
        <AdminInventoryPanel
          documents={documents}
          selectedDocument={selectedDocument}
          onSelectDocument={setSelectedDocumentId}
          onDeleteDocument={(documentId) => void handleDeleteDocument(documentId)}
        />
      </section>

      <AdminIngestSidebar
        domain={domain}
        notebookPreset={notebookPreset}
        title={title}
        url={url}
        reasonForFit={reasonForFit}
        content={content}
        submitting={submitting}
        message={message}
        error={error}
        jobs={jobs}
        onDomainChange={setDomain}
        onTitleChange={setTitle}
        onUrlChange={setUrl}
        onReasonForFitChange={setReasonForFit}
        onContentChange={setContent}
        onDryRun={(event) => void handleIngest(event, true)}
        onSubmit={(event) => void handleIngest(event, false)}
      />
    </div>
  );
}
