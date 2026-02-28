export type AdminStatusDomainFilter = "all" | "fiscal" | "laboral" | "mercado";

export interface AdminStatusFilters {
  domain: AdminStatusDomainFilter;
  topic: string;
  query: string;
  limit: number;
  offset: number;
}

export function parseAdminStatusFilters(searchParams: URLSearchParams): AdminStatusFilters {
  const rawDomain = searchParams.get("domain")?.trim().toLowerCase() ?? "all";
  const domain: AdminStatusDomainFilter =
    rawDomain === "fiscal" || rawDomain === "laboral" || rawDomain === "mercado" ? rawDomain : "all";
  const topic = searchParams.get("topic")?.trim() ?? "";
  const query = searchParams.get("query")?.trim() ?? "";
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const offsetValue = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
  const offset = Number.isFinite(offsetValue) ? Math.max(offsetValue, 0) : 0;

  return {
    domain,
    topic,
    query,
    limit,
    offset,
  };
}

export function escapeIlikeValue(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
}
