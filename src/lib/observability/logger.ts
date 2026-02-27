import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogData = Record<string, unknown>;

const REDACT_KEYS = new Set(["email", "accessToken", "authorization", "password", "token"]);

function sanitize(data: LogData): LogData {
  const out: LogData = {};
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    if (REDACT_KEYS.has(keyLower)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function getRequestId(headerValue?: string | null): string {
  return headerValue?.trim() || randomUUID();
}

export function log(level: LogLevel, event: string, requestId: string, data: LogData = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    request_id: requestId,
    ...sanitize(data),
  };
  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }
  console.log(JSON.stringify(payload));
}

