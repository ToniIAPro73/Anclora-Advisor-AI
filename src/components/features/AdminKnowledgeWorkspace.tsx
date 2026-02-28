"use client";

import {
  AdminHardwarePanel,
  AdminHeaderPanel,
  AdminIngestSidebar,
  AdminInventoryPanel,
  AdminObservabilityPanel,
} from "./admin/AdminKnowledgePanels";
import type { AdminDocumentRecord } from "./admin/admin-knowledge-types";
import { useAdminKnowledgeWorkspace } from "@/hooks/useAdminKnowledgeWorkspace";

export type { AdminDocumentRecord } from "./admin/admin-knowledge-types";

interface AdminKnowledgeWorkspaceProps {
  initialDocuments: AdminDocumentRecord[];
  initialDocumentCount: number;
  initialChunkCount: number;
}

export function AdminKnowledgeWorkspace({
  initialDocuments,
  initialDocumentCount,
  initialChunkCount,
}: AdminKnowledgeWorkspaceProps) {
  const { state, actions } = useAdminKnowledgeWorkspace({
    initialDocuments,
    initialDocumentCount,
    initialChunkCount,
  });

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="flex min-h-0 flex-col gap-4">
        <AdminHeaderPanel
          documentCount={state.documentCount}
          chunkCount={state.chunkCount}
          notebookTitle={state.notebookPreset.notebookTitle}
          refreshing={state.refreshing}
          onRefresh={() => void actions.refreshStatus()}
        />
        <AdminObservabilityPanel summary={state.traceSummary} traces={state.traces} />
        <AdminHardwarePanel
          runtimeGate={state.hardware?.runtimeGate}
          baseline={state.hardware?.baseline}
          benchmark={state.hardware?.benchmark}
        />
        <AdminInventoryPanel
          documents={state.filteredDocuments}
          totalDocuments={state.documents.length}
          domainFilter={state.inventoryDomainFilter}
          topicFilter={state.inventoryTopicFilter}
          search={state.inventorySearch}
          selectedDocument={state.selectedDocument}
          onDomainFilterChange={actions.setInventoryDomainFilter}
          onTopicFilterChange={actions.setInventoryTopicFilter}
          onSearchChange={actions.setInventorySearch}
          onSelectDocument={actions.setSelectedDocumentId}
          onDeleteDocument={(documentId) => void actions.deleteDocument(documentId)}
        />
      </section>

      <AdminIngestSidebar
        domain={state.domain}
        notebookPreset={state.notebookPreset}
        title={state.title}
        url={state.url}
        reasonForFit={state.reasonForFit}
        content={state.content}
        submitting={state.submitting}
        message={state.message}
        error={state.error}
        jobs={state.jobs}
        onDomainChange={actions.setDomain}
        onTitleChange={actions.setTitle}
        onUrlChange={actions.setUrl}
        onReasonForFitChange={actions.setReasonForFit}
        onContentChange={actions.setContent}
        onDryRun={(event) => void actions.submitIngest(event, true)}
        onSubmit={(event) => void actions.submitIngest(event, false)}
      />
    </div>
  );
}
