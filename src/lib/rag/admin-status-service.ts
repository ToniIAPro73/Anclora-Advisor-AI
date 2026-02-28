import { escapeIlikeValue, type AdminStatusFilters } from "./admin-status-filters";

type QueryResult = {
  data?: unknown[];
  count?: number | null;
  error?: { message: string } | null;
};

type AwaitableQueryLike = PromiseLike<any> & {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => AwaitableQueryLike;
  order: (column: string, options?: { ascending?: boolean }) => AwaitableQueryLike;
  range: (from: number, to: number) => AwaitableQueryLike;
  ilike: (column: string, pattern: string) => AwaitableQueryLike;
  or: (clause: string) => AwaitableQueryLike;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => AwaitableQueryLike;
  };
};

export interface AdminStatusDataResult {
  counts: {
    documents: number;
    chunks: number;
    filteredDocuments: number;
  };
  filters: AdminStatusFilters;
  recentDocuments: unknown[];
  recentJobs: unknown[];
}

export async function getAdminStatusData({
  supabase,
  filters,
  listRecentJobs,
}: {
  supabase: SupabaseLike;
  filters: AdminStatusFilters;
  listRecentJobs: (limit: number) => Promise<unknown[]>;
}): Promise<AdminStatusDataResult> {
  const { domain, topic, query, limit, offset } = filters;

  let documentsQuery = supabase
    .from("rag_documents")
    .select("id, title, category, created_at, doc_metadata")
    .order("created_at", { ascending: false });
  let filteredCountQuery = supabase.from("rag_documents").select("id", { count: "exact", head: true });

  if (domain === "fiscal") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%FISCAL%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%FISCAL%");
  } else if (domain === "laboral") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%RIESGO_LABORAL%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%RIESGO_LABORAL%");
  } else if (domain === "mercado") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%MARCA_POSICIONAMIENTO%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%MARCA_POSICIONAMIENTO%");
  }

  if (topic.length > 0) {
    documentsQuery = documentsQuery.ilike("doc_metadata->>topic", `%${topic}%`);
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>topic", `%${topic}%`);
  }

  if (query.length > 0) {
    const escaped = escapeIlikeValue(query);
    const orClause = [
      `title.ilike.%${escaped}%`,
      `doc_metadata->>notebook_title.ilike.%${escaped}%`,
      `doc_metadata->>topic.ilike.%${escaped}%`,
      `doc_metadata->>reason_for_fit.ilike.%${escaped}%`,
    ].join(",");
    documentsQuery = documentsQuery.or(orClause);
    filteredCountQuery = filteredCountQuery.or(orClause);
  }

  documentsQuery = documentsQuery.range(offset, offset + limit - 1);

  const [
    { count: documentCount },
    { count: chunkCount },
    { count: filteredDocumentCount, error: filteredCountError },
    { data: recentDocuments, error },
    recentJobs,
  ] = await Promise.all([
    supabase.from("rag_documents").select("id", { count: "exact", head: true }),
    supabase.from("rag_chunks").select("id", { count: "exact", head: true }),
    filteredCountQuery,
    documentsQuery,
    listRecentJobs(8),
  ]);

  if (error || filteredCountError) {
    throw new Error(error?.message ?? filteredCountError?.message ?? "Unknown status error");
  }

  return {
    counts: {
      documents: documentCount ?? 0,
      chunks: chunkCount ?? 0,
      filteredDocuments: filteredDocumentCount ?? 0,
    },
    filters,
    recentDocuments: recentDocuments ?? [],
    recentJobs,
  };
}
