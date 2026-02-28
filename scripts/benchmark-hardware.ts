import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface RuntimeProfile {
  key: string;
  label: string;
  baseUrl: string;
  chatModels: string[];
  embedModel: string;
}

interface ChatCase {
  id: string;
  prompt: string;
  system: string;
}

interface ChatBenchmarkRow {
  profile: string;
  base_url: string;
  model: string;
  case_id: string;
  latency_ms: number;
  ok: boolean;
  chars: number;
  error?: string;
}

interface EmbeddingBenchmarkRow {
  profile: string;
  base_url: string;
  model: string;
  sample_id: string;
  latency_ms: number;
  ok: boolean;
  dimensions: number;
  error?: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), "artifacts/hardware_benchmark_report.json");

const CHAT_CASES: ChatCase[] = [
  {
    id: "grounded_simple",
    prompt: "Cuando puedo solicitar la cuota 0 de autonomos?",
    system:
      "Eres Anclora Advisor. Responde con brevedad y no inventes datos. Usa este contexto: la Cuota Cero Baleares 2025 puede solicitarse del 11 de mayo al 16 de junio de 2025 si no se agota antes el credito.",
  },
  {
    id: "faq_simple",
    prompt: "Explica de forma breve que es la cuota cero para autonomos.",
    system: "Eres Anclora Advisor. Responde de forma breve, clara y profesional.",
  },
];

const EMBED_SAMPLES = [
  {
    id: "short_query",
    text: "plazo solicitud cuota cero autonomos baleares 2025",
  },
  {
    id: "long_chunk",
    text:
      "La Cuota Cero permite compensar cuotas de cotizacion del RETA para nuevos autonomos en Baleares, sujeta a convocatoria, requisitos, credito disponible y acreditacion documental.",
  },
];

function parseModelList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProfiles(): RuntimeProfile[] {
  const primary = {
    key: "primary",
    label: process.env.OLLAMA_PROFILE_NAME ?? "default_ollama",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    chatModels: parseModelList(process.env.HW_BENCHMARK_MODELS, [
      process.env.OLLAMA_MODEL_FAST ?? "llama3.2:latest",
      process.env.OLLAMA_MODEL_PRIMARY ?? process.env.OLLAMA_MODEL ?? "qwen2.5:14b",
    ]),
    embedModel: process.env.OLLAMA_EMBED_MODEL ?? "all-minilm",
  } satisfies RuntimeProfile;

  const altBaseUrl = process.env.OLLAMA_BASE_URL_ALT?.trim();
  const profiles = [primary];
  if (altBaseUrl) {
    profiles.push({
      key: "alt",
      label: process.env.OLLAMA_PROFILE_NAME_ALT ?? "alternate_runtime",
      baseUrl: altBaseUrl,
      chatModels: parseModelList(process.env.HW_BENCHMARK_MODELS_ALT, [
        process.env.OLLAMA_MODEL_FAST_ALT ??
          process.env.OLLAMA_MODEL_FAST ??
          "llama3.2:latest",
        process.env.OLLAMA_MODEL_PRIMARY_ALT ??
          process.env.OLLAMA_MODEL_PRIMARY ??
          process.env.OLLAMA_MODEL ??
          "qwen2.5:14b",
      ]),
      embedModel: process.env.OLLAMA_EMBED_MODEL_ALT ?? process.env.OLLAMA_EMBED_MODEL ?? "all-minilm",
    } satisfies RuntimeProfile);
  }

  return profiles;
}

async function fetchTags(profile: RuntimeProfile): Promise<string[]> {
  const response = await fetch(`${profile.baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  return (data.models ?? []).map((item) => item.name).filter((value): value is string => Boolean(value));
}

async function runChatCase(profile: RuntimeProfile, model: string, item: ChatCase): Promise<ChatBenchmarkRow> {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${profile.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: item.system },
          { role: "user", content: item.prompt },
        ],
      }),
    });

    if (!response.ok) {
      return {
        profile: profile.label,
        base_url: profile.baseUrl,
        model,
        case_id: item.id,
        latency_ms: Date.now() - startedAt,
        ok: false,
        chars: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim() ?? "";

    return {
      profile: profile.label,
      base_url: profile.baseUrl,
      model,
      case_id: item.id,
      latency_ms: Date.now() - startedAt,
      ok: text.length > 0,
      chars: text.length,
      error: text.length > 0 ? undefined : "empty_response",
    };
  } catch (error) {
    return {
      profile: profile.label,
      base_url: profile.baseUrl,
      model,
      case_id: item.id,
      latency_ms: Date.now() - startedAt,
      ok: false,
      chars: 0,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

async function runEmbeddingCase(
  profile: RuntimeProfile,
  sampleId: string,
  text: string
): Promise<EmbeddingBenchmarkRow> {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${profile.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: profile.embedModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      return {
        profile: profile.label,
        base_url: profile.baseUrl,
        model: profile.embedModel,
        sample_id: sampleId,
        latency_ms: Date.now() - startedAt,
        ok: false,
        dimensions: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { embedding?: number[] };
    const dimensions = Array.isArray(data.embedding) ? data.embedding.length : 0;

    return {
      profile: profile.label,
      base_url: profile.baseUrl,
      model: profile.embedModel,
      sample_id: sampleId,
      latency_ms: Date.now() - startedAt,
      ok: dimensions > 0,
      dimensions,
      error: dimensions > 0 ? undefined : "empty_embedding",
    };
  } catch (error) {
    return {
      profile: profile.label,
      base_url: profile.baseUrl,
      model: profile.embedModel,
      sample_id: sampleId,
      latency_ms: Date.now() - startedAt,
      ok: false,
      dimensions: 0,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

async function main(): Promise<void> {
  const profiles = buildProfiles();
  const availableProfiles: Array<RuntimeProfile & { availableModels: string[]; connection_ok: boolean; connection_error?: string }> = [];

  console.log("=== Hardware Benchmark ===");
  for (const profile of profiles) {
    try {
      const availableModels = await fetchTags(profile);
      availableProfiles.push({ ...profile, availableModels, connection_ok: true });
      console.log(`[profile] ${profile.label} -> ok models=${availableModels.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      availableProfiles.push({
        ...profile,
        availableModels: [],
        connection_ok: false,
        connection_error: message,
      });
      console.log(`[profile] ${profile.label} -> unavailable error=${message}`);
    }
  }

  const chatResults: ChatBenchmarkRow[] = [];
  const embeddingResults: EmbeddingBenchmarkRow[] = [];

  for (const profile of availableProfiles.filter((item) => item.connection_ok)) {
    const filteredModels = profile.chatModels.filter((model, index, all) => all.indexOf(model) === index);
    for (const model of filteredModels) {
      for (const item of CHAT_CASES) {
        const result = await runChatCase(profile, model, item);
        chatResults.push(result);
        console.log(
          `[chat] ${profile.label} ${model} ${item.id} -> ok=${result.ok ? 1 : 0} latency=${result.latency_ms}ms chars=${result.chars}${result.error ? ` error=${result.error}` : ""}`
        );
      }
    }

    for (const sample of EMBED_SAMPLES) {
      const result = await runEmbeddingCase(profile, sample.id, sample.text);
      embeddingResults.push(result);
      console.log(
        `[embed] ${profile.label} ${profile.embedModel} ${sample.id} -> ok=${result.ok ? 1 : 0} latency=${result.latency_ms}ms dims=${result.dimensions}${result.error ? ` error=${result.error}` : ""}`
      );
    }
  }

  const profileSummary = availableProfiles.map((profile) => {
    const chatRows = chatResults.filter((item) => item.profile === profile.label && item.ok);
    const embeddingRows = embeddingResults.filter((item) => item.profile === profile.label && item.ok);
    return {
      profile: profile.label,
      base_url: profile.baseUrl,
      connection_ok: profile.connection_ok,
      connection_error: profile.connection_error,
      available_models: profile.availableModels,
      configured_chat_models: profile.chatModels,
      configured_embed_model: profile.embedModel,
      avg_chat_latency_ms: average(chatRows.map((item) => item.latency_ms)),
      avg_embedding_latency_ms: average(embeddingRows.map((item) => item.latency_ms)),
      successful_chat_runs: chatRows.length,
      successful_embedding_runs: embeddingRows.length,
    };
  });

  const comparisonMode = availableProfiles.length > 1 ? "multi_profile" : "single_profile";
  const comparison = profileSummary
    .filter((item) => item.connection_ok)
    .sort((a, b) => (a.avg_chat_latency_ms ?? Number.POSITIVE_INFINITY) - (b.avg_chat_latency_ms ?? Number.POSITIVE_INFINITY));

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        comparison_mode: comparisonMode,
        note:
          comparisonMode === "single_profile"
            ? "Only one runtime profile is configured. Add OLLAMA_BASE_URL_ALT to compare runtimes."
            : "Profiles compared using configured chat and embedding models.",
        profiles: profileSummary,
        chat_cases: CHAT_CASES,
        embedding_samples: EMBED_SAMPLES.map((item) => item.id),
        chat_results: chatResults,
        embedding_results: embeddingResults,
        ranking: comparison,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\n--- Summary ---");
  for (const item of profileSummary) {
    console.log(
      `${item.profile}: connection=${item.connection_ok ? "ok" : "failed"} avg_chat=${item.avg_chat_latency_ms?.toFixed(1) ?? "n/a"}ms avg_embed=${item.avg_embedding_latency_ms?.toFixed(1) ?? "n/a"}ms`
    );
  }
  console.log(`report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("[benchmark-hardware] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
