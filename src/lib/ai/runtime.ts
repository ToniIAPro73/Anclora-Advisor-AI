export type AIRuntimeProfile = "local" | "cloudflare" | "groq-cloudflare";
export type ChatProvider = "ollama" | "cloudflare" | "groq";
export type EmbeddingProvider = "ollama" | "cloudflare";

type ChatModelSet = {
  primary: string;
  fallback: string;
  fast: string;
  noEvidence: string;
  guard: string;
};

export interface ChatRuntimeConfig {
  provider: ChatProvider;
  label: string;
  baseUrl: string;
  apiKey: string | null;
  temperature: number;
  models: ChatModelSet;
}

export interface EmbeddingRuntimeConfig {
  provider: EmbeddingProvider;
  label: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  expectedDimension: number;
}

export interface AIRuntimeConfig {
  profile: AIRuntimeProfile;
  chat: ChatRuntimeConfig;
  embeddings: EmbeddingRuntimeConfig;
}

export interface AIRuntimeSummary {
  profile: AIRuntimeProfile;
  chatProvider: ChatProvider;
  embeddingProvider: EmbeddingProvider;
  chatBaseUrl: string;
  embeddingBaseUrl: string;
  chatModels: ChatModelSet;
  embeddingModel: string;
  expectedEmbeddingDimension: number;
}

type OpenAICompatibleChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

type OpenAICompatibleEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type OllamaEmbeddingResponse = {
  embedding?: number[];
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function parsePositiveInteger(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProfile(): AIRuntimeProfile {
  const raw = (readEnv("AI_RUNTIME_PROFILE") ?? "local").toLowerCase();
  if (raw === "local" || raw === "cloudflare" || raw === "groq-cloudflare") {
    return raw;
  }
  throw new Error(
    `Unsupported AI_RUNTIME_PROFILE="${raw}". Expected one of: local, cloudflare, groq-cloudflare.`
  );
}

function buildCloudflareBaseUrl(): string {
  const explicit = readEnv("CLOUDFLARE_AI_BASE_URL");
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
}

function buildCloudflareEmbeddingConfig(baseUrl: string, apiKey: string): EmbeddingRuntimeConfig {
  return {
    provider: "cloudflare",
    label: "cloudflare",
    baseUrl,
    apiKey,
    model: readEnv("CLOUDFLARE_EMBED_MODEL") ?? "@cf/baai/bge-small-en-v1.5",
    expectedDimension: parsePositiveInteger("EMBEDDING_EXPECTED_DIMENSION", 384),
  };
}

function buildLocalConfig(): AIRuntimeConfig {
  const baseUrl = normalizeBaseUrl(readEnv("OLLAMA_BASE_URL") ?? "http://localhost:11434");
  return {
    profile: "local",
    chat: {
      provider: "ollama",
      label: "ollama",
      baseUrl,
      apiKey: null,
      temperature: 0.1,
      models: {
        primary: readEnv("OLLAMA_MODEL_PRIMARY") ?? readEnv("OLLAMA_MODEL") ?? "qwen2.5:14b",
        fallback: readEnv("OLLAMA_MODEL_FALLBACK") ?? "llama3.1:8b",
        fast: readEnv("OLLAMA_MODEL_FAST") ?? "llama3.2:latest",
        noEvidence: readEnv("OLLAMA_MODEL_NO_EVIDENCE") ?? "gemma3:1b",
        guard: readEnv("OLLAMA_MODEL_GUARD") ?? readEnv("OLLAMA_MODEL_FAST") ?? "llama3.2:latest",
      },
    },
    embeddings: {
      provider: "ollama",
      label: "ollama",
      baseUrl,
      apiKey: null,
      model: readEnv("OLLAMA_EMBED_MODEL") ?? "all-minilm",
      expectedDimension: parsePositiveInteger("EMBEDDING_EXPECTED_DIMENSION", 384),
    },
  };
}

function buildCloudflareConfig(): AIRuntimeConfig {
  const apiKey = requireEnv("CLOUDFLARE_API_TOKEN");
  const baseUrl = buildCloudflareBaseUrl();
  const fastModel = readEnv("CLOUDFLARE_MODEL_FAST") ?? "@cf/meta/llama-3.1-8b-instruct";

  return {
    profile: "cloudflare",
    chat: {
      provider: "cloudflare",
      label: "cloudflare",
      baseUrl,
      apiKey,
      temperature: 0.1,
      models: {
        primary: readEnv("CLOUDFLARE_MODEL_PRIMARY") ?? "@cf/openai/gpt-oss-20b",
        fallback: readEnv("CLOUDFLARE_MODEL_FALLBACK") ?? "@cf/meta/llama-3.1-8b-instruct",
        fast: fastModel,
        noEvidence: readEnv("CLOUDFLARE_MODEL_NO_EVIDENCE") ?? fastModel,
        guard: readEnv("CLOUDFLARE_MODEL_GUARD") ?? fastModel,
      },
    },
    embeddings: buildCloudflareEmbeddingConfig(baseUrl, apiKey),
  };
}

function buildGroqCloudflareConfig(): AIRuntimeConfig {
  const groqApiKey = requireEnv("GROQ_API_KEY");
  const groqBaseUrl = normalizeBaseUrl(readEnv("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1");
  const cloudflareApiKey = requireEnv("CLOUDFLARE_API_TOKEN");
  const cloudflareBaseUrl = buildCloudflareBaseUrl();
  const fastModel = readEnv("GROQ_MODEL_FAST") ?? "llama-3.1-8b-instant";

  return {
    profile: "groq-cloudflare",
    chat: {
      provider: "groq",
      label: "groq",
      baseUrl: groqBaseUrl,
      apiKey: groqApiKey,
      temperature: 0.1,
      models: {
        primary: readEnv("GROQ_MODEL_PRIMARY") ?? "openai/gpt-oss-20b",
        fallback: readEnv("GROQ_MODEL_FALLBACK") ?? "llama-3.3-70b-versatile",
        fast: fastModel,
        noEvidence: readEnv("GROQ_MODEL_NO_EVIDENCE") ?? fastModel,
        guard: readEnv("GROQ_MODEL_GUARD") ?? fastModel,
      },
    },
    embeddings: buildCloudflareEmbeddingConfig(cloudflareBaseUrl, cloudflareApiKey),
  };
}

export function getAIRuntimeConfig(): AIRuntimeConfig {
  const profile = resolveProfile();
  switch (profile) {
    case "local":
      return buildLocalConfig();
    case "cloudflare":
      return buildCloudflareConfig();
    case "groq-cloudflare":
      return buildGroqCloudflareConfig();
    default:
      return buildLocalConfig();
  }
}

export function getAIRuntimeSummary(): AIRuntimeSummary {
  const runtime = getAIRuntimeConfig();
  return {
    profile: runtime.profile,
    chatProvider: runtime.chat.provider,
    embeddingProvider: runtime.embeddings.provider,
    chatBaseUrl: runtime.chat.baseUrl,
    embeddingBaseUrl: runtime.embeddings.baseUrl,
    chatModels: runtime.chat.models,
    embeddingModel: runtime.embeddings.model,
    expectedEmbeddingDimension: runtime.embeddings.expectedDimension,
  };
}

function extractTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

async function generateChatWithOllama(
  config: ChatRuntimeConfig,
  model: string,
  systemPrompt: string,
  query: string
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: {
        temperature: config.temperature,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama ${model} error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  const text = data.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error(`Ollama ${model} returned empty response`);
  }
  return text;
}

async function generateChatWithOpenAICompatible(
  config: ChatRuntimeConfig,
  model: string,
  systemPrompt: string,
  query: string
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: config.temperature,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.label} ${model} error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenAICompatibleChatResponse;
  const text = extractTextContent(data.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error(`${config.label} ${model} returned empty response`);
  }
  return text;
}

export async function generateChatText(model: string, systemPrompt: string, query: string): Promise<string> {
  const runtime = getAIRuntimeConfig();
  if (runtime.chat.provider === "ollama") {
    return generateChatWithOllama(runtime.chat, model, systemPrompt, query);
  }
  return generateChatWithOpenAICompatible(runtime.chat, model, systemPrompt, query);
}

async function generateEmbeddingWithOllama(config: EmbeddingRuntimeConfig, text: string): Promise<number[]> {
  const response = await fetch(`${config.baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Ollama embeddings request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as OllamaEmbeddingResponse;
  const embedding = data.embedding ?? [];
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Ollama embeddings returned empty embedding");
  }
  return embedding;
}

async function generateEmbeddingWithOpenAICompatible(
  config: EmbeddingRuntimeConfig,
  text: string
): Promise<number[]> {
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${config.label} embeddings request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as OpenAICompatibleEmbeddingResponse;
  const embedding = data.data?.[0]?.embedding ?? [];
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`${config.label} embeddings returned empty embedding`);
  }
  return embedding;
}

export async function generateEmbeddingVector(text: string): Promise<number[]> {
  const runtime = getAIRuntimeConfig();
  if (runtime.embeddings.provider === "ollama") {
    return generateEmbeddingWithOllama(runtime.embeddings, text);
  }
  return generateEmbeddingWithOpenAICompatible(runtime.embeddings, text);
}
