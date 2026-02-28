import { getAdminStatusData } from "../../src/lib/rag/admin-status-service";
import type { AdminStatusFilters } from "../../src/lib/rag/admin-status-filters";

class FakeResultBuilder implements PromiseLike<{ data?: unknown[]; count?: number | null; error?: { message: string } | null }> {
  private readonly table: string;
  private readonly localOperations: string[];
  private readonly globalLog: string[];

  constructor(table: string, globalLog: string[], localOperations: string[] = []) {
    this.table = table;
    this.globalLog = globalLog;
    this.localOperations = localOperations;
  }

  private track(entry: string) {
    this.localOperations.push(entry);
    this.globalLog.push(entry);
  }

  select(columns: string, options?: { count?: "exact"; head?: boolean }) {
    this.track(`select:${this.table}:${columns}:${options?.count ?? ""}:${options?.head ? "head" : ""}`);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.track(`order:${column}:${options?.ascending === false ? "desc" : "asc"}`);
    return this;
  }

  range(from: number, to: number) {
    this.track(`range:${from}:${to}`);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.track(`ilike:${column}:${pattern}`);
    return this;
  }

  or(clause: string) {
    this.track(`or:${clause}`);
    return this;
  }

  then<TResult1 = { data?: unknown[]; count?: number | null; error?: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data?: unknown[]; count?: number | null; error?: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const hasFilters = this.localOperations.some((item) => item.startsWith("ilike:") || item.startsWith("or:"));
    const isHeadCount = this.localOperations.some((item) => item.includes(":exact:head"));
    const value =
      this.table === "rag_chunks"
        ? { count: 44, error: null }
        : isHeadCount
          ? { count: hasFilters ? 3 : 12, error: null }
          : { data: [{ id: "doc-1", title: "Cuota Cero" }], error: null };

    return Promise.resolve(value).then(onfulfilled, onrejected);
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(`Admin status service test failed: ${label}`);
  }
  console.log(`OK  ${label}`);
}

async function main(): Promise<void> {
  console.log("=== Admin Status Service Test ===");

  const queryLog: string[] = [];

  const supabase = {
    from(table: string) {
      return new FakeResultBuilder(table, queryLog);
    },
  };

  const filters: AdminStatusFilters = {
    domain: "fiscal",
    topic: "iva",
    query: "cuota",
    limit: 25,
    offset: 25,
  };

  const payload = await getAdminStatusData({
    supabase,
    filters,
    listRecentJobs: async () => [{ id: "job-1" }],
  });

  assert(payload.counts.documents === 12, "global document count");
  assert(payload.counts.chunks === 44, "chunk count");
  assert(payload.counts.filteredDocuments === 3, "filtered document count");
  assert(Array.isArray(payload.recentDocuments) && payload.recentDocuments.length === 1, "documents returned");
  assert(Array.isArray(payload.recentJobs) && payload.recentJobs.length === 1, "jobs returned");

  const joined = queryLog.join("|");
  assert(joined.includes("ilike:doc_metadata->>notebook_title:%FISCAL%"), "domain filter applied");
  assert(joined.includes("ilike:doc_metadata->>topic:%iva%"), "topic filter applied");
  assert(joined.includes("range:25:49"), "offset pagination applied");

  console.log("Admin status service: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
