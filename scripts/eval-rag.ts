import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Orchestrator } from '../lib/agents/orchestrator';
import { retrieveContext } from '../src/lib/rag/retrieval';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type EvalDomain = 'fiscal' | 'laboral' | 'mercado' | 'none';
type EvalType = 'in_domain' | 'out_of_domain';

interface EvalCase {
  id: string;
  query: string;
  expected_domain: EvalDomain;
  type: EvalType;
}

interface CliOptions {
  datasetPath: string;
  k: number;
  threshold: number;
  includeChat: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    datasetPath: path.resolve(process.cwd(), 'docs/evals/rag_eval_dataset_v1.json'),
    k: 5,
    threshold: 0.2,
    includeChat: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--dataset=')) {
      opts.datasetPath = path.resolve(process.cwd(), arg.slice('--dataset='.length));
      continue;
    }
    if (arg.startsWith('--k=')) {
      const parsed = Number.parseInt(arg.slice('--k='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) opts.k = parsed;
      continue;
    }
    if (arg.startsWith('--threshold=')) {
      const parsed = Number.parseFloat(arg.slice('--threshold='.length));
      if (Number.isFinite(parsed)) opts.threshold = parsed;
      continue;
    }
    if (arg === '--include-chat') {
      opts.includeChat = true;
    }
  }

  return opts;
}

function loadDataset(datasetPath: string): EvalCase[] {
  const raw = fs.readFileSync(datasetPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Dataset must be an array');
  }

  return parsed.map((item, idx) => {
    const row = item as Partial<EvalCase>;
    if (!row.id || !row.query || !row.expected_domain || !row.type) {
      throw new Error(`Invalid dataset row at index ${idx}`);
    }
    return row as EvalCase;
  });
}

function reciprocalRank(hitIndex: number): number {
  if (hitIndex < 0) return 0;
  return 1 / (hitIndex + 1);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const dataset = loadDataset(opts.datasetPath);
  const inDomain = dataset.filter((c) => c.type === 'in_domain' && c.expected_domain !== 'none');
  const outDomain = dataset.filter((c) => c.type === 'out_of_domain' || c.expected_domain === 'none');

  console.log('=== RAG Eval v1 ===');
  console.log(`Dataset: ${opts.datasetPath}`);
  console.log(`Cases: total=${dataset.length}, in_domain=${inDomain.length}, out_of_domain=${outDomain.length}`);
  console.log(`Retrieval params: k=${opts.k}, threshold=${opts.threshold}`);
  console.log(`Chat checks: ${opts.includeChat ? 'enabled' : 'disabled'}`);
  console.log('');

  let hits = 0;
  let mrrSum = 0;
  const domainBuckets: Record<'fiscal' | 'laboral' | 'mercado', { total: number; hit: number; mrrSum: number }> = {
    fiscal: { total: 0, hit: 0, mrrSum: 0 },
    laboral: { total: 0, hit: 0, mrrSum: 0 },
    mercado: { total: 0, hit: 0, mrrSum: 0 },
  };

  for (const c of inDomain) {
    const chunks = await retrieveContext(c.query, {
      category: c.expected_domain,
      limit: opts.k,
      threshold: opts.threshold,
    });

    const matchIdx = chunks.findIndex((ch) => ch.metadata.category === c.expected_domain);
    const rr = reciprocalRank(matchIdx);
    const hit = matchIdx >= 0 ? 1 : 0;

    hits += hit;
    mrrSum += rr;
    const bucket = domainBuckets[c.expected_domain];
    bucket.total += 1;
    bucket.hit += hit;
    bucket.mrrSum += rr;

    const top = chunks[0];
    console.log(
      `IN  ${c.id}: hit=${hit} rr=${rr.toFixed(3)} top=${top ? `${top.metadata.category}@${top.similarity.toFixed(2)}` : 'none'}`
    );
  }

  let outDomainFallbackHits = 0;
  let outDomainTotal = 0;
  if (opts.includeChat && outDomain.length > 0) {
    const orchestrator = new Orchestrator();
    for (const c of outDomain) {
      const response = await orchestrator.processQuery('eval-user', '00000000-0000-0000-0000-000000000999', c.query);
      const fallbackOk = response.groundingConfidence === 'none' && response.citations.length === 0;
      outDomainTotal += 1;
      if (fallbackOk) outDomainFallbackHits += 1;
      console.log(`OUT ${c.id}: fallback_ok=${fallbackOk ? 1 : 0} grounding=${response.groundingConfidence} citations=${response.citations.length}`);
    }
  }

  const hitAtK = inDomain.length > 0 ? hits / inDomain.length : 0;
  const mrr = inDomain.length > 0 ? mrrSum / inDomain.length : 0;

  console.log('\n--- Summary ---');
  console.log(`hit@${opts.k}: ${(hitAtK * 100).toFixed(1)}%`);
  console.log(`MRR@${opts.k}: ${mrr.toFixed(3)}`);

  for (const [domain, metrics] of Object.entries(domainBuckets)) {
    const domainHit = metrics.total > 0 ? metrics.hit / metrics.total : 0;
    const domainMrr = metrics.total > 0 ? metrics.mrrSum / metrics.total : 0;
    console.log(`${domain}: hit@${opts.k}=${(domainHit * 100).toFixed(1)}% mrr=${domainMrr.toFixed(3)} n=${metrics.total}`);
  }

  if (opts.includeChat && outDomainTotal > 0) {
    const fallbackRate = outDomainFallbackHits / outDomainTotal;
    console.log(`out_of_domain_fallback_rate: ${(fallbackRate * 100).toFixed(1)}%`);
  }
}

main().catch((error) => {
  console.error('[rag:eval] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
