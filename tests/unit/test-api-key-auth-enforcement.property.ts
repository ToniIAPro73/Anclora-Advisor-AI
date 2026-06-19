/**
 * Property-Based Test: API Key Authentication Enforcement (Property 9)
 *
 * **Validates: Requirements 11.2**
 *
 * Property statement: "For any request to the Advisor AI internal API, if the
 * X-Advisor-Internal-API-Key header is missing or does not match the configured
 * key, the response shall be HTTP 401 Unauthorized."
 *
 * Tests the verifyInternalLegalValidationRequest function directly with random
 * inputs. Uses fast-check to generate requests with missing, empty, or incorrect
 * API keys.
 *
 * Run: npx tsx tests/unit/test-api-key-auth-enforcement.property.ts
 */

import * as fc from "fast-check";
import { verifyInternalLegalValidationRequest } from "../../src/lib/legal-documents/internal-api-security";

// ─── Test Helpers ───────────────────────────────────────────────────────────────

const TEST_CONFIGURED_KEY = "test-configured-secret-key-abc123xyz";

function setupEnv(key: string | undefined): void {
  if (key === undefined) {
    delete process.env.ADVISOR_INTERNAL_API_KEY;
  } else {
    process.env.ADVISOR_INTERNAL_API_KEY = key;
  }
  // Disable rate limiting for property tests so it doesn't interfere
  process.env.ADVISOR_LEGAL_VALIDATION_RATE_LIMIT = "0";
}

function makeHeaders(options: {
  apiKey?: string | null;
  authorization?: string | null;
  caller?: string;
}): Headers {
  const headers = new Headers();
  if (options.apiKey !== undefined && options.apiKey !== null) {
    headers.set("x-advisor-internal-api-key", options.apiKey);
  }
  if (options.authorization !== undefined && options.authorization !== null) {
    headers.set("authorization", options.authorization);
  }
  if (options.caller) {
    headers.set("x-advisor-caller", options.caller);
  }
  return headers;
}

// ─── Generators ─────────────────────────────────────────────────────────────────

/** Generates a non-empty API key that is guaranteed NOT to equal the configured key. */
const incorrectKeyArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim() !== TEST_CONFIGURED_KEY && s.trim().length > 0);

/** Generates arbitrary request IDs. */
const requestIdArb: fc.Arbitrary<string> = fc.string({
  minLength: 1,
  maxLength: 50,
});

/** Generates arbitrary caller identifiers. */
const callerArb: fc.Arbitrary<string> = fc.string({
  minLength: 0,
  maxLength: 30,
});

// ─── Property Tests ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function reportResult(success: boolean, label: string, details?: string): void {
  if (success) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    if (details) console.error(`        ${details}`);
  }
}

console.log("\n=== Property 9: API Key Authentication Enforcement ===\n");

// ── Property: Missing API key header returns 401 ────────────────────────────────
console.log("Property: Requests with no API key header return HTTP 401\n");

setupEnv(TEST_CONFIGURED_KEY);

try {
  fc.assert(
    fc.property(requestIdArb, callerArb, (requestId, caller) => {
      setupEnv(TEST_CONFIGURED_KEY);
      const headers = makeHeaders({ caller });
      const result = verifyInternalLegalValidationRequest(headers, requestId);
      return result.ok === false && result.status === 401;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "Missing API key header returns 401 (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Missing API key header returns 401", msg);
}

// ── Property: Empty API key header returns 401 ──────────────────────────────────
console.log(
  "\nProperty: Requests with empty or whitespace-only API key return HTTP 401\n",
);

try {
  fc.assert(
    fc.property(
      requestIdArb,
      callerArb,
      fc.constantFrom("", " ", "  ", "\t", "\n", "   \t  "),
      (requestId, caller, emptyKey) => {
        setupEnv(TEST_CONFIGURED_KEY);
        const headers = makeHeaders({ apiKey: emptyKey, caller });
        const result = verifyInternalLegalValidationRequest(headers, requestId);
        return result.ok === false && result.status === 401;
      },
    ),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "Empty/whitespace API key returns 401 (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Empty/whitespace API key returns 401", msg);
}

// ── Property: Incorrect API key returns 401 ─────────────────────────────────────
console.log("\nProperty: Requests with incorrect API key return HTTP 401\n");

try {
  fc.assert(
    fc.property(
      incorrectKeyArb,
      requestIdArb,
      callerArb,
      (wrongKey, requestId, caller) => {
        setupEnv(TEST_CONFIGURED_KEY);
        const headers = makeHeaders({ apiKey: wrongKey, caller });
        const result = verifyInternalLegalValidationRequest(headers, requestId);
        return result.ok === false && result.status === 401;
      },
    ),
    { numRuns: 5000, verbose: 0 },
  );
  reportResult(true, "Incorrect API key returns 401 (5000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Incorrect API key returns 401", msg);
}

// ── Property: Incorrect Bearer token returns 401 ────────────────────────────────
console.log(
  "\nProperty: Requests with incorrect Bearer token return HTTP 401\n",
);

try {
  fc.assert(
    fc.property(
      incorrectKeyArb,
      requestIdArb,
      callerArb,
      (wrongKey, requestId, caller) => {
        setupEnv(TEST_CONFIGURED_KEY);
        const headers = makeHeaders({
          authorization: `Bearer ${wrongKey}`,
          caller,
        });
        const result = verifyInternalLegalValidationRequest(headers, requestId);
        return result.ok === false && result.status === 401;
      },
    ),
    { numRuns: 3000, verbose: 0 },
  );
  reportResult(true, "Incorrect Bearer token returns 401 (3000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Incorrect Bearer token returns 401", msg);
}

// ── Property: Correct API key returns 200 (positive case) ───────────────────────
console.log("\nProperty: Requests with correct API key return HTTP 200\n");

try {
  fc.assert(
    fc.property(requestIdArb, callerArb, (requestId, caller) => {
      setupEnv(TEST_CONFIGURED_KEY);
      const headers = makeHeaders({
        apiKey: TEST_CONFIGURED_KEY,
        caller,
      });
      const result = verifyInternalLegalValidationRequest(headers, requestId);
      return result.ok === true && result.status === 200;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "Correct API key returns 200 (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Correct API key returns 200", msg);
}

// ── Property: Correct Bearer token returns 200 ──────────────────────────────────
console.log("\nProperty: Requests with correct Bearer token return HTTP 200\n");

try {
  fc.assert(
    fc.property(requestIdArb, callerArb, (requestId, caller) => {
      setupEnv(TEST_CONFIGURED_KEY);
      const headers = makeHeaders({
        authorization: `Bearer ${TEST_CONFIGURED_KEY}`,
        caller,
      });
      const result = verifyInternalLegalValidationRequest(headers, requestId);
      return result.ok === true && result.status === 200;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "Correct Bearer token returns 200 (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Correct Bearer token returns 200", msg);
}

// ── Property: Server returns 503 when env var is not configured ──────────────────
console.log(
  "\nProperty: Requests return 503 when ADVISOR_INTERNAL_API_KEY env is not set\n",
);

try {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 50 }),
      requestIdArb,
      callerArb,
      (anyKey, requestId, caller) => {
        setupEnv(undefined);
        const headers = makeHeaders({ apiKey: anyKey, caller });
        const result = verifyInternalLegalValidationRequest(headers, requestId);
        return result.ok === false && result.status === 503;
      },
    ),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "Unconfigured env var returns 503 (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Unconfigured env var returns 503", msg);
}

// ─── Cleanup and Summary ────────────────────────────────────────────────────────

// Restore env
setupEnv(undefined);

console.log(`\n${"=".repeat(60)}`);
console.log(
  `PROPERTY 9 (API Key Auth Enforcement): ${passed} passed, ${failed} failed`,
);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
