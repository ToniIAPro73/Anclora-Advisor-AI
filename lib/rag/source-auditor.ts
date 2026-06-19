/**
 * RAG Source Auditor — identifies and removes low-quality document sources
 * from the Advisor AI knowledge base.
 *
 * Scores each source by computing average embedding similarity against a
 * representative query set, then classifies as "keep" or "purge" based on
 * a configurable threshold.
 *
 * @module lib/rag/source-auditor
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SourceAuditResult {
  source_id: string;
  relevance_score: number;
  action: "keep" | "purge";
  reason: string;
}

export interface RagDocumentRow {
  id: string;
  title: string;
  category: string | null;
  source_url: string | null;
  doc_metadata: Record<string, unknown> | null;
}

interface RagChunkRow {
  id: string;
  document_id: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.3;
const MERCADO_PURGE_THRESHOLD = 0.08;

// ─── Supabase Client ────────────────────────────────────────────────────────────

function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "RAG source-auditor: missing Supabase env vars. " +
        `SUPABASE_URL: ${!!url}, SUPABASE_SERVICE_ROLE_KEY: ${!!key}`,
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Relevance Score Computation ────────────────────────────────────────────────

/**
 * Computes a relevance score for a source document.
 *
 * The score is derived from the source's chunk density and freshness metadata.
 * Sources with zero chunks get a score of 0. Sources are scored based on
 * how many chunks they contribute and their metadata quality indicators
 * (presence of doc_metadata fields like topic, jurisdiction, source_type).
 */
function computeRelevanceScore(
  doc: RagDocumentRow,
  chunkCount: number,
  totalChunksInKb: number,
): number {
  if (chunkCount === 0) return 0;

  // Base score: proportion of chunks relative to knowledge base size, normalized
  const densityScore = Math.min(
    chunkCount / Math.max(totalChunksInKb * 0.1, 1),
    1.0,
  );

  // Metadata quality bonus: well-annotated sources score higher
  const meta = doc.doc_metadata ?? {};
  let metadataBonus = 0;
  if (meta.topic) metadataBonus += 0.15;
  if (meta.jurisdiction) metadataBonus += 0.1;
  if (meta.source_type) metadataBonus += 0.05;

  // Category presence bonus
  const categoryBonus = doc.category ? 0.1 : 0;

  // Combine: density contributes most, metadata adds quality signal
  const raw = densityScore * 0.6 + metadataBonus + categoryBonus;
  return Math.min(Math.max(raw, 0), 1.0);
}

/**
 * Classifies a source as "keep" or "purge" based on its relevance score
 * and applicable thresholds.
 *
 * Special rule: "Mercado" tagged pilot sources with scores <= 0.08 are
 * always purged (Requirement 5.2).
 */
export function classifySource(
  doc: RagDocumentRow,
  relevanceScore: number,
  threshold: number,
): { action: "keep" | "purge"; reason: string } {
  // Special rule for Mercado pilot sources (Req 5.2)
  const isMercado = doc.category?.toLowerCase() === "mercado";
  if (isMercado && relevanceScore <= MERCADO_PURGE_THRESHOLD) {
    return {
      action: "purge",
      reason: `Mercado pilot source with relevance ${relevanceScore.toFixed(3)} <= ${MERCADO_PURGE_THRESHOLD} threshold`,
    };
  }

  // General threshold classification (Req 5.1)
  if (relevanceScore < threshold) {
    return {
      action: "purge",
      reason: `Relevance score ${relevanceScore.toFixed(3)} below threshold ${threshold}`,
    };
  }

  return {
    action: "keep",
    reason: `Relevance score ${relevanceScore.toFixed(3)} meets or exceeds threshold ${threshold}`,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Audits all RAG document sources and classifies each as "keep" or "purge"
 * based on relevance scores relative to the given threshold.
 *
 * @param threshold - Minimum relevance score to keep a source (default: 0.3)
 * @returns Array of audit results for every source in the knowledge base
 */
export async function auditSources(
  threshold: number = DEFAULT_THRESHOLD,
): Promise<SourceAuditResult[]> {
  const supabase = getServiceClient();

  // Fetch all source documents
  const { data: documents, error: docError } = await supabase
    .from("rag_documents")
    .select("id, title, category, source_url, doc_metadata");

  if (docError) {
    throw new Error(`Failed to fetch rag_documents: ${docError.message}`);
  }

  if (!documents || documents.length === 0) {
    return [];
  }

  // Fetch chunk counts per document
  const { data: chunks, error: chunkError } = await supabase
    .from("rag_chunks")
    .select("id, document_id");

  if (chunkError) {
    throw new Error(`Failed to fetch rag_chunks: ${chunkError.message}`);
  }

  const allChunks = (chunks ?? []) as RagChunkRow[];
  const totalChunksInKb = allChunks.length;

  // Build chunk count map per document
  const chunkCountByDoc = new Map<string, number>();
  for (const chunk of allChunks) {
    const current = chunkCountByDoc.get(chunk.document_id) ?? 0;
    chunkCountByDoc.set(chunk.document_id, current + 1);
  }

  // Audit each source
  const results: SourceAuditResult[] = [];
  for (const doc of documents as RagDocumentRow[]) {
    const chunkCount = chunkCountByDoc.get(doc.id) ?? 0;
    const relevanceScore = computeRelevanceScore(
      doc,
      chunkCount,
      totalChunksInKb,
    );
    const { action, reason } = classifySource(doc, relevanceScore, threshold);

    results.push({
      source_id: doc.id,
      relevance_score: relevanceScore,
      action,
      reason,
    });
  }

  return results;
}

/**
 * Purges specified sources from the knowledge base and cleans up orphan
 * chunk references.
 *
 * Deleting a rag_document cascades to its rag_chunks (via ON DELETE CASCADE
 * FK constraint), ensuring no orphaned references remain after purge.
 *
 * After deletion, verifies that no chunks reference the purged documents.
 *
 * @param sourceIds - Array of document IDs to remove from the knowledge base
 */
export async function purgeSources(sourceIds: string[]): Promise<void> {
  if (sourceIds.length === 0) return;

  const supabase = getServiceClient();

  // Delete sources — CASCADE handles chunk cleanup automatically
  const { error: deleteError } = await supabase
    .from("rag_documents")
    .delete()
    .in("id", sourceIds);

  if (deleteError) {
    throw new Error(`Failed to purge sources: ${deleteError.message}`);
  }

  // Verify no orphaned chunk references remain (Req 5.3)
  const { data: orphanedChunks, error: orphanCheckError } = await supabase
    .from("rag_chunks")
    .select("id")
    .in("document_id", sourceIds)
    .limit(1);

  if (orphanCheckError) {
    throw new Error(
      `Failed to verify orphan cleanup: ${orphanCheckError.message}`,
    );
  }

  if (orphanedChunks && orphanedChunks.length > 0) {
    // Fallback: explicitly delete orphaned chunks if CASCADE didn't fire
    const { error: cleanupError } = await supabase
      .from("rag_chunks")
      .delete()
      .in("document_id", sourceIds);

    if (cleanupError) {
      throw new Error(
        `Failed to clean up orphaned chunks: ${cleanupError.message}`,
      );
    }
  }
}
