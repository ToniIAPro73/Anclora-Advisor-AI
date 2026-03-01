"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditLogRecord } from "@/lib/audit/logs";
import type {
  AdminAuditLogsResponse,
  AdminDocumentRecord,
  AdminDocumentVersionDiffRecord,
  AdminDocumentVersionRecord,
  IngestResponse,
  NotebookPreset,
  ObservabilityResponse,
  StatusResponse,
} from "@/components/features/admin/admin-knowledge-types";

export const NOTEBOOK_PRESETS: Record<string, NotebookPreset> = {
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

function inferDocumentDomain(document: AdminDocumentRecord): "fiscal" | "laboral" | "mercado" | "unknown" {
  const notebookTitle = document.doc_metadata?.notebook_title?.toLowerCase() ?? "";
  if (notebookTitle.includes("fiscal")) return "fiscal";
  if (notebookTitle.includes("riesgo_laboral") || notebookTitle.includes("laboral")) return "laboral";
  if (notebookTitle.includes("marca_posicionamiento") || notebookTitle.includes("mercado")) return "mercado";
  return "unknown";
}

export function useAdminKnowledgeWorkspace({
  initialDocuments,
  initialDocumentCount,
  initialChunkCount,
  initialAuditLogs,
}: {
  initialDocuments: AdminDocumentRecord[];
  initialDocumentCount: number;
  initialChunkCount: number;
  initialAuditLogs: AuditLogRecord[];
}) {
  const [documents, setDocuments] = useState<AdminDocumentRecord[]>(initialDocuments);
  const [documentCount, setDocumentCount] = useState(initialDocumentCount);
  const [filteredDocumentCount, setFilteredDocumentCount] = useState(initialDocuments.length);
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
  const [inventoryDomainFilter, setInventoryDomainFilter] = useState<"all" | "fiscal" | "laboral" | "mercado">("all");
  const [inventoryTopicFilter, setInventoryTopicFilter] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(0);
  const [inventoryPageSize, setInventoryPageSize] = useState<25 | 50 | 100>(50);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<15 | 30 | 60>(30);
  const [jobs, setJobs] = useState<NonNullable<StatusResponse["recentJobs"]>>([]);
  const [traceSummary, setTraceSummary] = useState<ObservabilityResponse["summary"]>();
  const [traces, setTraces] = useState<NonNullable<ObservabilityResponse["traces"]>>([]);
  const [hardware, setHardware] = useState<ObservabilityResponse["hardware"]>();
  const [cron, setCron] = useState<ObservabilityResponse["cron"]>();
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [documentVersions, setDocumentVersions] = useState<AdminDocumentVersionRecord[]>([]);
  const [documentVersionDiff, setDocumentVersionDiff] = useState<AdminDocumentVersionDiffRecord | null>(null);
  const [selectedLeftVersionId, setSelectedLeftVersionId] = useState<string | null>(null);
  const [selectedRightVersionId, setSelectedRightVersionId] = useState<string | null>(null);
  const [loadingVersionDiff, setLoadingVersionDiff] = useState(false);
  const [rollingBackDocumentId, setRollingBackDocumentId] = useState<string | null>(null);

  const notebookPreset = useMemo(() => NOTEBOOK_PRESETS[domain], [domain]);
  const filteredDocuments = useMemo(() => {
    const topicQuery = inventoryTopicFilter.trim().toLowerCase();
    const searchQuery = inventorySearch.trim().toLowerCase();

    return documents.filter((document) => {
      const domainMatch =
        inventoryDomainFilter === "all" ? true : inferDocumentDomain(document) === inventoryDomainFilter;
      const topicValue = document.doc_metadata?.topic?.toLowerCase() ?? "";
      const notebookValue = document.doc_metadata?.notebook_title?.toLowerCase() ?? "";
      const titleValue = document.title.toLowerCase();
      const reasonValue = document.doc_metadata?.reason_for_fit?.toLowerCase() ?? "";
      const topicMatch = topicQuery.length === 0 ? true : topicValue.includes(topicQuery);
      const searchMatch =
        searchQuery.length === 0
          ? true
          : titleValue.includes(searchQuery) ||
            notebookValue.includes(searchQuery) ||
            topicValue.includes(searchQuery) ||
            reasonValue.includes(searchQuery);

      return domainMatch && topicMatch && searchMatch;
    });
  }, [documents, inventoryDomainFilter, inventorySearch, inventoryTopicFilter]);
  const selectedDocument = useMemo(
    () => filteredDocuments.find((document) => document.id === selectedDocumentId) ?? filteredDocuments[0] ?? null,
    [filteredDocuments, selectedDocumentId]
  );

  const refreshDocumentVersions = useCallback(async (documentId: string | null): Promise<void> => {
    if (!documentId) {
      setDocumentVersions([]);
      setDocumentVersionDiff(null);
      setSelectedLeftVersionId(null);
      setSelectedRightVersionId(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/rag/documents/${documentId}`, { cache: "no-store" });
      const result = (await response.json()) as {
        success: boolean;
        versions?: AdminDocumentVersionRecord[];
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudieron cargar versiones del documento");
      }
      const versions = result.versions ?? [];
      setDocumentVersions(versions);
      const nextLeftVersionId = versions[0]?.id ?? null;
      const nextRightVersionId = versions[1]?.id ?? null;
      setSelectedLeftVersionId((current) => (current && versions.some((version) => version.id === current) ? current : nextLeftVersionId));
      setSelectedRightVersionId((current) =>
        current && versions.some((version) => version.id === current) ? current : nextRightVersionId
      );
    } catch (versionError) {
      setError(versionError instanceof Error ? versionError.message : "Error al cargar versiones");
    }
  }, []);

  const refreshVersionDiff = useCallback(
    async (documentId: string | null, leftVersionId: string | null, rightVersionId: string | null): Promise<void> => {
      if (!documentId || !leftVersionId || !rightVersionId || leftVersionId === rightVersionId) {
        setDocumentVersionDiff(null);
        return;
      }

      setLoadingVersionDiff(true);
      try {
        const diffUrl = new URL(`/api/admin/rag/documents/${documentId}`, window.location.origin);
        diffUrl.searchParams.set("view", "diff");
        diffUrl.searchParams.set("leftVersionId", leftVersionId);
        diffUrl.searchParams.set("rightVersionId", rightVersionId);

        const response = await fetch(diffUrl.toString(), { cache: "no-store" });
        const result = (await response.json()) as {
          success: boolean;
          diff?: AdminDocumentVersionDiffRecord;
          error?: string;
        };
        if (!response.ok || !result.success) {
          throw new Error(result.error ?? "No se pudo calcular el diff de versiones");
        }
        setDocumentVersionDiff(result.diff ?? null);
      } catch (diffError) {
        setError(diffError instanceof Error ? diffError.message : "Error al calcular diff");
      } finally {
        setLoadingVersionDiff(false);
      }
    },
    []
  );

  const refreshStatus = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    setError(null);

    try {
      const statusUrl = new URL("/api/admin/rag/status", window.location.origin);
      statusUrl.searchParams.set("limit", String(inventoryPageSize));
      statusUrl.searchParams.set("offset", String(inventoryPage * inventoryPageSize));
      statusUrl.searchParams.set("domain", inventoryDomainFilter);
      if (inventoryTopicFilter.trim().length > 0) {
        statusUrl.searchParams.set("topic", inventoryTopicFilter.trim());
      }
      if (inventorySearch.trim().length > 0) {
        statusUrl.searchParams.set("query", inventorySearch.trim());
      }

      const [statusResponse, observabilityResponse, auditResponse] = await Promise.all([
        fetch(statusUrl.toString(), { cache: "no-store" }),
        fetch("/api/admin/observability/rag", { cache: "no-store" }),
        fetch("/api/audit-logs?domain=admin_rag&limit=8", { cache: "no-store" }),
      ]);
      const statusResult = (await statusResponse.json()) as StatusResponse;
      const observabilityResult = (await observabilityResponse.json()) as ObservabilityResponse;
      const auditResult = (await auditResponse.json()) as AdminAuditLogsResponse;
      if (!statusResponse.ok || !statusResult.success) {
        throw new Error(statusResult.error ?? "No se pudo refrescar el estado RAG");
      }
      if (!observabilityResponse.ok || !observabilityResult.success) {
        throw new Error(observabilityResult.error ?? "No se pudo refrescar la observabilidad RAG");
      }
      if (!auditResponse.ok || !auditResult.success) {
        throw new Error(auditResult.error ?? "No se pudo refrescar la auditoria admin RAG");
      }

      setDocuments(statusResult.recentDocuments ?? []);
      setDocumentCount(statusResult.counts.documents ?? 0);
      setFilteredDocumentCount(statusResult.counts.filteredDocuments ?? statusResult.recentDocuments?.length ?? 0);
      setChunkCount(statusResult.counts.chunks ?? 0);
      setJobs(statusResult.recentJobs ?? []);
      setTraceSummary(observabilityResult.summary);
      setTraces(observabilityResult.traces ?? []);
      setHardware(observabilityResult.hardware);
      setCron(observabilityResult.cron);
      setAuditLogs(auditResult.logs ?? []);
      const nextSelectedDocumentId = selectedDocumentId ?? statusResult.recentDocuments?.[0]?.id ?? null;
      setSelectedDocumentId(nextSelectedDocumentId);
      await refreshDocumentVersions(nextSelectedDocumentId);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Error al refrescar estado");
    } finally {
      setRefreshing(false);
    }
  }, [inventoryDomainFilter, inventoryPage, inventoryPageSize, inventorySearch, inventoryTopicFilter, refreshDocumentVersions, selectedDocumentId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    setInventoryPage(0);
  }, [inventoryDomainFilter, inventoryPageSize, inventorySearch, inventoryTopicFilter]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = window.setInterval(() => {
      void refreshStatus();
    }, autoRefreshIntervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshIntervalSec, refreshStatus]);

  useEffect(() => {
    void refreshDocumentVersions(selectedDocumentId);
  }, [refreshDocumentVersions, selectedDocumentId]);

  useEffect(() => {
    void refreshVersionDiff(selectedDocumentId, selectedLeftVersionId, selectedRightVersionId);
  }, [refreshVersionDiff, selectedDocumentId, selectedLeftVersionId, selectedRightVersionId]);

  const submitIngest = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, dryRun: boolean): Promise<void> => {
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
    },
    [content, domain, notebookPreset.notebookId, notebookPreset.notebookTitle, reasonForFit, refreshStatus, title, url]
  );

  const deleteDocument = useCallback(
    async (documentId: string): Promise<void> => {
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
    },
    [refreshStatus]
  );

  const rollbackDocument = useCallback(
    async (documentId: string, versionId: string): Promise<void> => {
      if (!window.confirm("Se restauraran metadata y chunks desde esta version. Continuar?")) {
        return;
      }

      setRollingBackDocumentId(documentId);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch(`/api/admin/rag/documents/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rollback", versionId }),
        });
        const result = (await response.json()) as { success: boolean; error?: string; restoredVersion?: number };
        if (!response.ok || !result.success) {
          throw new Error(result.error ?? "No se pudo restaurar el documento");
        }
        setMessage(`Documento restaurado a la version ${result.restoredVersion ?? "n/d"}.`);
        await refreshStatus();
      } catch (rollbackError) {
        setError(rollbackError instanceof Error ? rollbackError.message : "Error al restaurar documento");
      } finally {
        setRollingBackDocumentId(null);
      }
    },
    [refreshStatus]
  );

  return {
    state: {
      documents,
      documentCount,
      filteredDocumentCount,
      chunkCount,
      domain,
      title,
      url,
      reasonForFit,
      content,
      submitting,
      refreshing,
      message,
      error,
      inventoryDomainFilter,
      inventoryTopicFilter,
      inventorySearch,
      inventoryPage,
      inventoryPageSize,
      autoRefreshEnabled,
      autoRefreshIntervalSec,
      filteredDocuments,
      selectedDocumentId,
      selectedDocument,
      jobs,
      traceSummary,
      traces,
      hardware,
      cron,
      auditLogs,
      documentVersions,
      documentVersionDiff,
      selectedLeftVersionId,
      selectedRightVersionId,
      loadingVersionDiff,
      rollingBackDocumentId,
      notebookPreset,
    },
    actions: {
      setDomain,
      setTitle,
      setUrl,
      setReasonForFit,
      setContent,
      setSelectedDocumentId,
      setInventoryDomainFilter,
      setInventoryTopicFilter,
      setInventorySearch,
      setInventoryPage,
      setInventoryPageSize,
      setAutoRefreshEnabled,
      setAutoRefreshIntervalSec,
      setSelectedLeftVersionId,
      setSelectedRightVersionId,
      refreshStatus,
      refreshDocumentVersions,
      refreshVersionDiff,
      submitIngest,
      deleteDocument,
      rollbackDocument,
    },
  };
}
