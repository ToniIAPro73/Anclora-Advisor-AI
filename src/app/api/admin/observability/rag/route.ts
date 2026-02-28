import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { getRequestId, log } from "@/lib/observability/logger";
import { listRagTraces, summarizeRagTraces } from "@/lib/observability/rag-traces";

type HardwareRuntimeGate = {
  decision: string;
  recommended_profile: string | null;
  reason: string;
  profiles?: Array<{
    profile: string;
    avg_chat_latency_ms: number | null;
    avg_embedding_latency_ms: number | null;
  }>;
};

type OllamaBaselineReport = {
  decision: string;
  checks: Array<{
    role: string;
    model: string;
    decision: string;
    quantization_level?: string;
    reason: string;
  }>;
};

type HardwareBenchmarkReport = {
  comparison_mode: string;
  profiles: Array<{
    profile: string;
    avg_chat_latency_ms: number | null;
    avg_embedding_latency_ms: number | null;
    configured_chat_models: string[];
    configured_embed_model: string;
  }>;
};

type CronStatus = {
  configured: boolean;
  secret_source: "APP_JOBS_CRON_SECRET" | "CRON_SECRET" | "missing";
  schedule: string | null;
  path: string | null;
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    log("warn", "api_admin_observability_rag_forbidden", requestId, {
      userId: appUser?.id ?? null,
      role: appUser?.role ?? null,
    });
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const artifactsDir = path.join(process.cwd(), "artifacts");
  const vercelConfig = await readJsonFile<{ crons?: Array<{ path: string; schedule: string }> }>(
    path.join(process.cwd(), "vercel.json")
  );
  const [hardwareGate, ollamaBaseline, hardwareBenchmark] = await Promise.all([
    readJsonFile<HardwareRuntimeGate>(path.join(artifactsDir, "hardware_runtime_gate.json")),
    readJsonFile<OllamaBaselineReport>(path.join(artifactsDir, "ollama_baseline_report.json")),
    readJsonFile<HardwareBenchmarkReport>(path.join(artifactsDir, "hardware_benchmark_report.json")),
  ]);

  const response = NextResponse.json({
    success: true,
    summary: summarizeRagTraces(100),
    traces: listRagTraces(25),
    hardware: {
      runtimeGate: hardwareGate,
      baseline: ollamaBaseline,
      benchmark: hardwareBenchmark,
    },
    cron: {
      configured: Boolean(process.env.APP_JOBS_CRON_SECRET || process.env.CRON_SECRET),
      secret_source: process.env.APP_JOBS_CRON_SECRET
        ? "APP_JOBS_CRON_SECRET"
        : process.env.CRON_SECRET
          ? "CRON_SECRET"
          : "missing",
      schedule: vercelConfig?.crons?.[0]?.schedule ?? null,
      path: vercelConfig?.crons?.[0]?.path ?? null,
    } satisfies CronStatus,
  });
  response.headers.set("x-request-id", requestId);
  return response;
}
