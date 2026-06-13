import crypto from "node:crypto";

interface CircuitState {
  failures: number;
  openedUntil: number;
}

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const circuit: CircuitState = { failures: 0, openedUntil: 0 };

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CACHE_TTL_MS = 10 * 60_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_BREAKER_THRESHOLD = 3;
const DEFAULT_BREAKER_COOLDOWN_MS = 30_000;

export class CircuitBreakerOpenError extends Error {
  constructor() {
    super("Legal validation circuit breaker is open");
    this.name = "CircuitBreakerOpenError";
  }
}

export function buildIdempotencyKey(payload: unknown, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const serialized = JSON.stringify(payload, Object.keys(payload as Record<string, unknown>).sort());
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export function getCachedIdempotentResult<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCachedIdempotentResult(key: string, value: unknown): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + readPositiveInt("ADVISOR_LEGAL_VALIDATION_IDEMPOTENCY_TTL_MS", DEFAULT_CACHE_TTL_MS),
  });
}

export async function runWithLegalValidationResilience<T>(operation: () => Promise<T>): Promise<T> {
  if (circuit.openedUntil > Date.now()) throw new CircuitBreakerOpenError();

  const attempts = readPositiveInt("ADVISOR_LEGAL_VALIDATION_RETRIES", DEFAULT_RETRIES) + 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await withTimeout(operation(), readPositiveInt("ADVISOR_LEGAL_VALIDATION_TIMEOUT_MS", DEFAULT_TIMEOUT_MS));
      circuit.failures = 0;
      circuit.openedUntil = 0;
      return result;
    } catch (error) {
      lastError = error;
      circuit.failures += 1;
      if (circuit.failures >= readPositiveInt("ADVISOR_LEGAL_VALIDATION_BREAKER_THRESHOLD", DEFAULT_BREAKER_THRESHOLD)) {
        circuit.openedUntil = Date.now() + readPositiveInt("ADVISOR_LEGAL_VALIDATION_BREAKER_COOLDOWN_MS", DEFAULT_BREAKER_COOLDOWN_MS);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Legal validation timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
