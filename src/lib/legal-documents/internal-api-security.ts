import crypto from "node:crypto";
import { log } from "@/lib/observability/logger";

const DEFAULT_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

export interface InternalApiAuthResult {
  ok: boolean;
  status: 200 | 401 | 429 | 503;
  caller: string;
  error?: string;
}

export function verifyInternalLegalValidationRequest(
  headers: Headers,
  requestId: string,
): InternalApiAuthResult {
  const configuredKey = process.env.ADVISOR_INTERNAL_API_KEY?.trim();
  const caller = headers.get("x-advisor-caller")?.trim() || "unknown";

  if (!configuredKey) {
    log("error", "advisor_internal_api_key_missing", requestId, { caller });
    return {
      ok: false,
      status: 503,
      caller,
      error: "Internal API key is not configured",
    };
  }

  const providedKey =
    headers.get("x-advisor-internal-api-key")?.trim() ||
    parseBearer(headers.get("authorization"));

  if (!providedKey) {
    log("warn", "advisor_internal_api_key_missing_from_request", requestId, {
      caller,
    });
    return {
      ok: false,
      status: 401,
      caller,
      error: "Missing internal API key",
    };
  }

  if (!safeEqual(providedKey, configuredKey)) {
    log("warn", "advisor_internal_api_key_invalid", requestId, { caller });
    return {
      ok: false,
      status: 401,
      caller,
      error: "Invalid internal API key",
    };
  }

  if (isRateLimited(caller)) {
    log("warn", "advisor_internal_api_rate_limited", requestId, { caller });
    return { ok: false, status: 429, caller, error: "Rate limit exceeded" };
  }

  log("info", "advisor_internal_api_authorized", requestId, { caller });
  return { ok: true, status: 200, caller };
}

function parseBearer(header: string | null): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? value?.trim() : undefined;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isRateLimited(caller: string): boolean {
  const limit = readPositiveInt(
    "ADVISOR_LEGAL_VALIDATION_RATE_LIMIT",
    DEFAULT_RATE_LIMIT,
  );
  if (limit <= 0) return false;

  const now = Date.now();
  const start = now - RATE_LIMIT_WINDOW_MS;
  const current = buckets.get(caller) ?? [];
  const recent = current.filter((timestamp) => timestamp >= start);
  if (recent.length >= limit) {
    buckets.set(caller, recent);
    return true;
  }
  recent.push(now);
  buckets.set(caller, recent);
  return false;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
