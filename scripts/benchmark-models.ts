import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface BenchmarkCase {
  id: string;
  query: string;
  type: 'grounded' | 'no_evidence';
  systemPrompt: string;
}

interface BenchmarkResult {
  model: string;
  case_id: string;
  type: 'grounded' | 'no_evidence';
  latency_ms: number;
  chars: number;
  ok: boolean;
  error?: string;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OUTPUT_PATH = path.resolve(process.cwd(), 'artifacts/model_benchmark_report.json');
const DEFAULT_MODELS = ['llama3.2:latest', 'phi3:latest', 'gemma3:1b'];

const GROUNDED_PROMPT = `Eres Anclora Advisor. Responde de forma breve y profesional usando solo el contexto dado.

CONTEXTO:
[1] Cuota cero en Baleares para nuevos autónomos
La ayuda Cuota Cero en Baleares para 2025 puede solicitarse desde el 11 de mayo hasta el 16 de junio de 2025, siempre que no se agote antes el crédito disponible.

CONSULTA:
{query}`;

const NO_EVIDENCE_PROMPT = `Eres Anclora Advisor. No inventes datos. Si no hay evidencia, dilo claramente y recomienda consultar una fuente fiable.

CONSULTA:
{query}`;

function parseModels(argv: string[]): string[] {
  const cliArg = argv.find((arg) => arg.startsWith('--models='));
  if (!cliArg) return DEFAULT_MODELS;
  return cliArg.slice('--models='.length).split(',').map((item) => item.trim()).filter(Boolean);
}

async function runCase(model: string, item: BenchmarkCase): Promise<BenchmarkResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          { role: 'system', content: item.systemPrompt.replace('{query}', item.query) },
          { role: 'user', content: item.query },
        ],
      }),
    });

    if (!response.ok) {
      return {
        model,
        case_id: item.id,
        type: item.type,
        latency_ms: Date.now() - startedAt,
        chars: 0,
        ok: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim() ?? '';

    return {
      model,
      case_id: item.id,
      type: item.type,
      latency_ms: Date.now() - startedAt,
      chars: text.length,
      ok: text.length > 0,
      error: text.length > 0 ? undefined : 'empty_response',
    };
  } catch (error) {
    return {
      model,
      case_id: item.id,
      type: item.type,
      latency_ms: Date.now() - startedAt,
      chars: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

async function main(): Promise<void> {
  const models = parseModels(process.argv.slice(2));
  const cases: BenchmarkCase[] = [
    {
      id: 'grounded_cuota_cero',
      query: 'Cuando puedo solicitar la cuota 0 de autonomos?',
      type: 'grounded',
      systemPrompt: GROUNDED_PROMPT,
    },
    {
      id: 'no_evidence_futbol',
      query: 'Quien gano el mundial de futbol en 1930?',
      type: 'no_evidence',
      systemPrompt: NO_EVIDENCE_PROMPT,
    },
  ];

  console.log('=== Model Benchmark ===');
  console.log(`Models: ${models.join(', ')}`);
  console.log(`Cases: ${cases.map((item) => item.id).join(', ')}`);
  console.log('');

  const results: BenchmarkResult[] = [];
  for (const model of models) {
    for (const item of cases) {
      const result = await runCase(model, item);
      results.push(result);
      console.log(
        `${model} :: ${item.id} -> ok=${result.ok ? 1 : 0} latency=${result.latency_ms}ms chars=${result.chars}${result.error ? ` error=${result.error}` : ''}`
      );
    }
  }

  const summary = models.map((model) => {
    const rows = results.filter((item) => item.model === model && item.ok);
    const avgLatency = rows.length > 0 ? rows.reduce((acc, item) => acc + item.latency_ms, 0) / rows.length : null;
    return {
      model,
      ok_count: rows.length,
      avg_latency_ms: avgLatency,
    };
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        models,
        results,
        summary,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n--- Summary ---');
  for (const item of summary) {
    console.log(`${item.model}: ok=${item.ok_count} avg_latency_ms=${item.avg_latency_ms?.toFixed(1) ?? 'n/a'}`);
  }
  console.log(`report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error('[benchmark-models] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
