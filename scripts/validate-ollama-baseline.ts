import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface OllamaShowResponse {
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
}

interface ModelCheck {
  role: string;
  model: string;
  ok: boolean;
  family?: string;
  parameter_size?: string;
  quantization_level?: string;
  decision: "GO" | "NO_GO";
  reason: string;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OUTPUT_PATH = path.resolve(process.cwd(), "artifacts/ollama_baseline_report.json");

function parseParameterBillions(parameterSize: string | undefined): number | null {
  if (!parameterSize) return null;
  const match = parameterSize.match(/^([0-9]+(?:\.[0-9]+)?)B$/i);
  return match ? Number.parseFloat(match[1]) : null;
}

async function inspectModel(role: string, model: string): Promise<ModelCheck> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) {
      return {
        role,
        model,
        ok: false,
        decision: "NO_GO",
        reason: `HTTP ${response.status} from /api/show`,
      };
    }

    const data = (await response.json()) as OllamaShowResponse;
    const family = data.details?.family;
    const parameterSize = data.details?.parameter_size;
    const quantizationLevel = data.details?.quantization_level;
    const parameterBillions = parseParameterBillions(parameterSize);

    if (role === "primary" && parameterBillions !== null && parameterBillions >= 10 && quantizationLevel !== "Q4_K_M") {
      return {
        role,
        model,
        ok: true,
        family,
        parameter_size: parameterSize,
        quantization_level: quantizationLevel,
        decision: "NO_GO",
        reason: "Primary model is >=10B but not running Q4_K_M. Keep 14B baseline on Q4_K_M for stability.",
      };
    }

    return {
      role,
      model,
      ok: true,
      family,
      parameter_size: parameterSize,
      quantization_level: quantizationLevel,
      decision: "GO",
      reason:
        role === "primary" && parameterBillions !== null && parameterBillions >= 10
          ? "Primary model matches the stable 14B Q4_K_M baseline."
          : "Model is available and acceptable for its configured role.",
    };
  } catch (error) {
    return {
      role,
      model,
      ok: false,
      decision: "NO_GO",
      reason: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

async function main(): Promise<void> {
  const checks = await Promise.all([
    inspectModel("primary", process.env.OLLAMA_MODEL_PRIMARY ?? process.env.OLLAMA_MODEL ?? "qwen2.5:14b"),
    inspectModel("fast", process.env.OLLAMA_MODEL_FAST ?? "llama3.2:latest"),
    inspectModel("fallback", process.env.OLLAMA_MODEL_FALLBACK ?? "llama3.1:8b"),
    inspectModel("embed", process.env.OLLAMA_EMBED_MODEL ?? "all-minilm"),
  ]);

  const decision = checks.every((item) => item.decision === "GO") ? "GO" : "NO_GO";
  const payload = {
    generated_at: new Date().toISOString(),
    ollama_base_url: OLLAMA_BASE_URL,
    decision,
    checks,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log("=== Ollama Baseline Validation ===");
  console.log(`decision: ${decision}`);
  for (const item of checks) {
    console.log(
      `${item.role}: ${item.model} -> ${item.decision} ${item.quantization_level ? `quant=${item.quantization_level}` : ""} ${item.reason}`
    );
  }
  console.log(`report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("[validate-ollama-baseline] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
