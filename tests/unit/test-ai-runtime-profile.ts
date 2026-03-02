import { getAIRuntimeConfig, getAIRuntimeSummary } from "../../src/lib/ai/runtime";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type EnvMap = Record<string, string | undefined>;

function withEnv(overrides: EnvMap, run: () => void): void {
  const original: EnvMap = {};
  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function main(): void {
  withEnv(
    {
      AI_RUNTIME_PROFILE: "local",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL_PRIMARY: "qwen2.5:14b",
      OLLAMA_MODEL_FAST: "llama3.2:latest",
      OLLAMA_MODEL_FALLBACK: "llama3.1:8b",
      OLLAMA_MODEL_NO_EVIDENCE: "gemma3:1b",
      OLLAMA_MODEL_GUARD: "llama3.2:latest",
      OLLAMA_EMBED_MODEL: "all-minilm",
      EMBEDDING_EXPECTED_DIMENSION: "384",
    },
    () => {
      const runtime = getAIRuntimeConfig();
      assert(runtime.profile === "local", "expected local profile");
      assert(runtime.chat.provider === "ollama", "expected ollama chat provider");
      assert(runtime.embeddings.provider === "ollama", "expected ollama embedding provider");
      assert(runtime.embeddings.expectedDimension === 384, "expected local embedding dimension");
    }
  );

  withEnv(
    {
      AI_RUNTIME_PROFILE: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "account-123",
      CLOUDFLARE_API_TOKEN: "token-123",
      CLOUDFLARE_MODEL_PRIMARY: "@cf/openai/gpt-oss-20b",
      CLOUDFLARE_MODEL_FAST: "@cf/meta/llama-3.1-8b-instruct",
      CLOUDFLARE_MODEL_FALLBACK: "@cf/meta/llama-3.1-8b-instruct",
      CLOUDFLARE_MODEL_NO_EVIDENCE: "@cf/meta/llama-3.1-8b-instruct",
      CLOUDFLARE_MODEL_GUARD: "@cf/meta/llama-3.1-8b-instruct",
      CLOUDFLARE_EMBED_MODEL: "@cf/baai/bge-small-en-v1.5",
      EMBEDDING_EXPECTED_DIMENSION: "384",
    },
    () => {
      const summary = getAIRuntimeSummary();
      assert(summary.profile === "cloudflare", "expected cloudflare profile");
      assert(summary.chatProvider === "cloudflare", "expected cloudflare chat provider");
      assert(summary.embeddingProvider === "cloudflare", "expected cloudflare embeddings");
      assert(
        summary.embeddingBaseUrl === "https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1",
        "expected cloudflare base url derived from account id"
      );
    }
  );

  withEnv(
    {
      AI_RUNTIME_PROFILE: "groq-cloudflare",
      GROQ_API_KEY: "groq-key",
      GROQ_MODEL_PRIMARY: "openai/gpt-oss-20b",
      GROQ_MODEL_FAST: "llama-3.1-8b-instant",
      GROQ_MODEL_FALLBACK: "llama-3.3-70b-versatile",
      GROQ_MODEL_NO_EVIDENCE: "llama-3.1-8b-instant",
      GROQ_MODEL_GUARD: "llama-3.1-8b-instant",
      CLOUDFLARE_ACCOUNT_ID: "account-456",
      CLOUDFLARE_API_TOKEN: "token-456",
      CLOUDFLARE_EMBED_MODEL: "@cf/baai/bge-small-en-v1.5",
      EMBEDDING_EXPECTED_DIMENSION: "384",
    },
    () => {
      const runtime = getAIRuntimeConfig();
      assert(runtime.profile === "groq-cloudflare", "expected groq-cloudflare profile");
      assert(runtime.chat.provider === "groq", "expected groq chat provider");
      assert(runtime.embeddings.provider === "cloudflare", "expected cloudflare embedding provider");
      assert(runtime.chat.models.primary === "openai/gpt-oss-20b", "expected groq primary model");
    }
  );

  let invalidProfileThrown = false;
  withEnv({ AI_RUNTIME_PROFILE: "broken-profile" }, () => {
    try {
      getAIRuntimeConfig();
    } catch {
      invalidProfileThrown = true;
    }
  });
  assert(invalidProfileThrown, "expected invalid profile to throw");

  console.log("AI runtime profile: PASS");
}

main();
