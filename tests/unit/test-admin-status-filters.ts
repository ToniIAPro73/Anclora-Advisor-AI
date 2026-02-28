import { escapeIlikeValue, parseAdminStatusFilters } from "../../src/lib/rag/admin-status-filters";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    throw new Error(`Admin status filters test failed: ${label}`);
  }
  console.log(`OK  ${label}`);
}

function main(): void {
  console.log("=== Admin Status Filters Test ===");

  const defaults = parseAdminStatusFilters(new URLSearchParams());
  assert(defaults.domain === "all", "default domain");
  assert(defaults.limit === 50, "default limit");
  assert(defaults.offset === 0, "default offset");

  const custom = parseAdminStatusFilters(
    new URLSearchParams("domain=fiscal&topic=iva&query=cuota&limit=200&offset=15")
  );
  assert(custom.domain === "fiscal", "custom domain");
  assert(custom.topic === "iva", "custom topic");
  assert(custom.query === "cuota", "custom query");
  assert(custom.limit === 100, "limit clamped to 100");
  assert(custom.offset === 15, "custom offset");

  const invalid = parseAdminStatusFilters(new URLSearchParams("domain=otro&limit=-1&offset=-4"));
  assert(invalid.domain === "all", "invalid domain falls back");
  assert(invalid.limit === 1, "negative limit clamped to 1");
  assert(invalid.offset === 0, "negative offset clamped to 0");

  assert(escapeIlikeValue("100%_match,test") === "100  match test", "query escaping");

  console.log("Admin status filters: PASS");
}

main();
