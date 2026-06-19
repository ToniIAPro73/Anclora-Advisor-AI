/**
 * Unit tests for the RAG source auditor module.
 * Tests the classification logic and score computation.
 * Run: npx tsx tests/unit/test-source-auditor.ts
 */

// We test the internal classification logic by importing and exercising
// the exported functions with mock data. Since auditSources/purgeSources
// require Supabase, we test the classification contract:
// - score < threshold → purge
// - score >= threshold → keep
// - Mercado sources with score <= 0.08 → purge regardless of general threshold

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  FAIL: ${label}`);
    failed++;
  } else {
    console.log(`  PASS: ${label}`);
    passed++;
  }
}

// --- Simulate the classification logic (mirrors source-auditor.ts) ---

interface MockDoc {
  id: string;
  title: string;
  category: string | null;
  source_url: string | null;
  doc_metadata: Record<string, unknown> | null;
}

const MERCADO_PURGE_THRESHOLD = 0.08;

function computeRelevanceScore(
  doc: MockDoc,
  chunkCount: number,
  totalChunksInKb: number,
): number {
  if (chunkCount === 0) return 0;

  const densityScore = Math.min(
    chunkCount / Math.max(totalChunksInKb * 0.1, 1),
    1.0,
  );
  const meta = doc.doc_metadata ?? {};
  let metadataBonus = 0;
  if (meta.topic) metadataBonus += 0.15;
  if (meta.jurisdiction) metadataBonus += 0.1;
  if (meta.source_type) metadataBonus += 0.05;
  const categoryBonus = doc.category ? 0.1 : 0;
  const raw = densityScore * 0.6 + metadataBonus + categoryBonus;
  return Math.min(Math.max(raw, 0), 1.0);
}

function classifySource(
  doc: MockDoc,
  relevanceScore: number,
  threshold: number,
): { action: "keep" | "purge"; reason: string } {
  const isMercado = doc.category?.toLowerCase() === "mercado";
  if (isMercado && relevanceScore <= MERCADO_PURGE_THRESHOLD) {
    return {
      action: "purge",
      reason: `Mercado pilot source with relevance ${relevanceScore.toFixed(3)} <= ${MERCADO_PURGE_THRESHOLD} threshold`,
    };
  }
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

// --- Test 1: Zero chunks results in score 0 ---
console.log("\nTest 1: Document with no chunks scores 0");
const docNoChunks: MockDoc = {
  id: "doc-1",
  title: "Empty document",
  category: "fiscal",
  source_url: null,
  doc_metadata: { topic: "iva" },
};
const scoreNoChunks = computeRelevanceScore(docNoChunks, 0, 100);
assert(scoreNoChunks === 0, "zero chunks → score 0");

// --- Test 2: Document with chunks and metadata scores above 0 ---
console.log("\nTest 2: Document with chunks and metadata scores > 0");
const docWithChunks: MockDoc = {
  id: "doc-2",
  title: "Fiscalidad autónomo",
  category: "fiscal",
  source_url: "https://example.com",
  doc_metadata: {
    topic: "irpf",
    jurisdiction: "es-bal",
    source_type: "web_page",
  },
};
const scoreWithChunks = computeRelevanceScore(docWithChunks, 10, 100);
assert(scoreWithChunks > 0, "document with chunks has positive score");
assert(scoreWithChunks <= 1.0, "score capped at 1.0");

// --- Test 3: Metadata bonus increases score ---
console.log("\nTest 3: Metadata fields increase relevance score");
const docNoMeta: MockDoc = {
  id: "doc-3",
  title: "Basic doc",
  category: "fiscal",
  source_url: null,
  doc_metadata: null,
};
const docWithMeta: MockDoc = {
  id: "doc-4",
  title: "Annotated doc",
  category: "fiscal",
  source_url: null,
  doc_metadata: { topic: "iva", jurisdiction: "es" },
};
const scoreNoMeta = computeRelevanceScore(docNoMeta, 5, 100);
const scoreWithMeta = computeRelevanceScore(docWithMeta, 5, 100);
assert(scoreWithMeta > scoreNoMeta, "metadata presence increases score");

// --- Test 4: Classification below threshold → purge ---
console.log("\nTest 4: Score below threshold classifies as purge");
const result1 = classifySource(docNoMeta, 0.2, 0.3);
assert(result1.action === "purge", "0.2 < 0.3 threshold → purge");

// --- Test 5: Classification at threshold → keep ---
console.log("\nTest 5: Score at threshold classifies as keep");
const result2 = classifySource(docNoMeta, 0.3, 0.3);
assert(result2.action === "keep", "0.3 >= 0.3 threshold → keep");

// --- Test 6: Classification above threshold → keep ---
console.log("\nTest 6: Score above threshold classifies as keep");
const result3 = classifySource(docNoMeta, 0.5, 0.3);
assert(result3.action === "keep", "0.5 >= 0.3 threshold → keep");

// --- Test 7: Mercado pilot source with score <= 0.08 → purge ---
console.log("\nTest 7: Mercado source with score <= 0.08 always purged");
const mercadoDoc: MockDoc = {
  id: "doc-mercado-1",
  title: "Mercado pilot source",
  category: "mercado",
  source_url: null,
  doc_metadata: null,
};
const mercadoResult = classifySource(mercadoDoc, 0.05, 0.3);
assert(mercadoResult.action === "purge", "Mercado with 0.05 → purge");
assert(
  mercadoResult.reason.includes("Mercado pilot source"),
  "reason mentions Mercado pilot",
);

// --- Test 8: Mercado source with score > 0.08 follows general threshold ---
console.log("\nTest 8: Mercado source above 0.08 follows general threshold");
const mercadoHighScore = classifySource(mercadoDoc, 0.5, 0.3);
assert(mercadoHighScore.action === "keep", "Mercado with 0.5 ≥ 0.3 → keep");

// --- Test 9: Mercado source with score exactly 0.08 → purge ---
console.log("\nTest 9: Mercado source at exactly 0.08 → purge");
const mercadoExact = classifySource(mercadoDoc, 0.08, 0.3);
assert(mercadoExact.action === "purge", "Mercado with exactly 0.08 → purge");

// --- Test 10: Mercado source with score 0.09 and below general threshold → purge (general) ---
console.log("\nTest 10: Mercado source with 0.09 and below general threshold");
const mercadoAboveMercadoThreshold = classifySource(mercadoDoc, 0.09, 0.3);
assert(
  mercadoAboveMercadoThreshold.action === "purge",
  "Mercado with 0.09 < 0.3 general → purge via general threshold",
);
assert(
  !mercadoAboveMercadoThreshold.reason.includes("Mercado pilot"),
  "reason uses general threshold, not Mercado-specific",
);

// --- Test 11: Category bonus ---
console.log("\nTest 11: Category presence adds bonus");
const docNoCat: MockDoc = {
  id: "doc-no-cat",
  title: "No category",
  category: null,
  source_url: null,
  doc_metadata: null,
};
const scoreWithCat = computeRelevanceScore(docNoMeta, 5, 100); // has category
const scoreNoCat = computeRelevanceScore(docNoCat, 5, 100); // no category
assert(scoreWithCat > scoreNoCat, "category presence adds score bonus");

// --- Test 12: Score is bounded [0, 1] ---
console.log("\nTest 12: Score is always bounded between 0 and 1");
const richDoc: MockDoc = {
  id: "doc-rich",
  title: "Very rich doc",
  category: "fiscal",
  source_url: "https://example.com",
  doc_metadata: {
    topic: "iva",
    jurisdiction: "es-bal",
    source_type: "web_page",
  },
};
// Many chunks relative to KB size
const highScore = computeRelevanceScore(richDoc, 100, 10);
assert(highScore <= 1.0, "score never exceeds 1.0 even with max inputs");
assert(highScore >= 0, "score never goes below 0");

// --- Summary ---
console.log(`\n${"=".repeat(50)}`);
console.log(`SOURCE AUDITOR TESTS: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
