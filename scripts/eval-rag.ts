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
  thresholdsPath: string;
  outputPath: string;
  k: number;
  retrievalThreshold: number;
  includeChat: boolean;
  enforce: boolean;
}

interface EvalThresholds {
  version: string;
  global: {
    min_hit_at_k: number;
    min_mrr_at_k: number;
    min_out_domain_fallback_rate?: number;
  };
  domains: Record<'fiscal' | 'laboral' | 'mercado', { min_hit_at_k: number; min_mrr_at_k: number }>;
}

interface DomainMetrics {
  total: number;
  hit: number;
  mrrSum: number;
}

interface EvalReport {
  generated_at: string;
  dataset_path: string;
  thresholds_path: string;
  output_path: string;
  params: {
    k: number;
    retrieval_threshold: number;
    include_chat: boolean;
    enforce: boolean;
  };
  cases: {
    total: number;
    in_domain: number;
    out_of_domain: number;
  };
  metrics: {
    hit_at_k: number;
    mrr_at_k: number;
    out_domain_fallback_rate?: number;
    by_domain: Record<'fiscal' | 'laboral' | 'mercado', { hit_at_k: number; mrr_at_k: number; n: number }>;
  };
  checks: Array<{ name: string; ok: boolean; expected: string; actual: string }>;
  decision: 'GO' | 'NO-GO';
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    datasetPath: path.resolve(process.cwd(), 'docs/evals/rag_eval_dataset_v1.json'),
    thresholdsPath: path.resolve(process.cwd(), 'docs/evals/rag_eval_thresholds_v1.json'),
    outputPath: path.resolve(process.cwd(), 'artifacts/rag_eval_report.json'),
    k: 5,
    retrievalThreshold: 0.2,
    includeChat: false,
    enforce: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--dataset=')) {
      opts.datasetPath = path.resolve(process.cwd(), arg.slice('--dataset='.length));
      continue;
    }
    if (arg.startsWith('--thresholds=')) {
      opts.thresholdsPath = path.resolve(process.cwd(), arg.slice('--thresholds='.length));
      continue;
    }
    if (arg.startsWith('--out=')) {
      opts.outputPath = path.resolve(process.cwd(), arg.slice('--out='.length));
      continue;
    }
    if (arg.startsWith('--k=')) {
      const parsed = Number.parseInt(arg.slice('--k='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) opts.k = parsed;
      continue;
    }
    if (arg.startsWith('--threshold=')) {
      const parsed = Number.parseFloat(arg.slice('--threshold='.length));
      if (Number.isFinite(parsed)) opts.retrievalThreshold = parsed;
      continue;
    }
    if (arg === '--include-chat') {
      opts.includeChat = true;
      continue;
    }
    if (arg === '--enforce') {
      opts.enforce = true;
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

function loadThresholds(thresholdsPath: string): EvalThresholds {
  const raw = fs.readFileSync(thresholdsPath, 'utf8');
  return JSON.parse(raw) as EvalThresholds;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const dataset = loadDataset(opts.datasetPath);
  const thresholds = loadThresholds(opts.thresholdsPath);
  const inDomain = dataset.filter((c) => c.type === 'in_domain' && c.expected_domain !== 'none');
  const outDomain = dataset.filter((c) => c.type === 'out_of_domain' || c.expected_domain === 'none');

  console.log('=== RAG Eval v1 ===');
  console.log(`Dataset: ${opts.datasetPath}`);
  console.log(`Thresholds: ${opts.thresholdsPath} (${thresholds.version})`);
  console.log(`Cases: total=${dataset.length}, in_domain=${inDomain.length}, out_of_domain=${outDomain.length}`);
  console.log(`Retrieval params: k=${opts.k}, threshold=${opts.retrievalThreshold}`);
  console.log(`Chat checks: ${opts.includeChat ? 'enabled' : 'disabled'}`);
  console.log(`Enforce gate: ${opts.enforce ? 'enabled' : 'disabled'}`);
  console.log('');

  let hits = 0;
  let mrrSum = 0;
  const domainBuckets: Record<'fiscal' | 'laboral' | 'mercado', DomainMetrics> = {
    fiscal: { total: 0, hit: 0, mrrSum: 0 },
    laboral: { total: 0, hit: 0, mrrSum: 0 },
    mercado: { total: 0, hit: 0, mrrSum: 0 },
  };

  for (const c of inDomain) {
    const chunks = await retrieveContext(c.query, {
      category: c.expected_domain,
      limit: opts.k,
      threshold: opts.retrievalThreshold,
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

  const domainOutput: EvalReport['metrics']['by_domain'] = {
    fiscal: { hit_at_k: 0, mrr_at_k: 0, n: 0 },
    laboral: { hit_at_k: 0, mrr_at_k: 0, n: 0 },
    mercado: { hit_at_k: 0, mrr_at_k: 0, n: 0 },
  };

  for (const [domain, metrics] of Object.entries(domainBuckets)) {
    const domainHit = metrics.total > 0 ? metrics.hit / metrics.total : 0;
    const domainMrr = metrics.total > 0 ? metrics.mrrSum / metrics.total : 0;
    console.log(`${domain}: hit@${opts.k}=${(domainHit * 100).toFixed(1)}% mrr=${domainMrr.toFixed(3)} n=${metrics.total}`);
    domainOutput[domain as keyof typeof domainOutput] = {
      hit_at_k: domainHit,
      mrr_at_k: domainMrr,
      n: metrics.total,
    };
  }

  const checks: EvalReport['checks'] = [];
  checks.push({
    name: `global_hit@${opts.k}`,
    ok: hitAtK >= thresholds.global.min_hit_at_k,
    expected: `>= ${thresholds.global.min_hit_at_k}`,
    actual: hitAtK.toFixed(3),
  });
  checks.push({
    name: `global_mrr@${opts.k}`,
    ok: mrr >= thresholds.global.min_mrr_at_k,
    expected: `>= ${thresholds.global.min_mrr_at_k}`,
    actual: mrr.toFixed(3),
  });

  (Object.keys(domainBuckets) as Array<keyof typeof domainBuckets>).forEach((domain) => {
    const metrics = domainOutput[domain];
    const th = thresholds.domains[domain];
    checks.push({
      name: `${domain}_hit@${opts.k}`,
      ok: metrics.hit_at_k >= th.min_hit_at_k,
      expected: `>= ${th.min_hit_at_k}`,
      actual: metrics.hit_at_k.toFixed(3),
    });
    checks.push({
      name: `${domain}_mrr@${opts.k}`,
      ok: metrics.mrr_at_k >= th.min_mrr_at_k,
      expected: `>= ${th.min_mrr_at_k}`,
      actual: metrics.mrr_at_k.toFixed(3),
    });
  });

  let outDomainFallbackRate: number | undefined;
  if (opts.includeChat && outDomainTotal > 0) {
    outDomainFallbackRate = outDomainFallbackHits / outDomainTotal;
    console.log(`out_of_domain_fallback_rate: ${(outDomainFallbackRate * 100).toFixed(1)}%`);
    if (typeof thresholds.global.min_out_domain_fallback_rate === 'number') {
      checks.push({
        name: 'out_domain_fallback_rate',
        ok: outDomainFallbackRate >= thresholds.global.min_out_domain_fallback_rate,
        expected: `>= ${thresholds.global.min_out_domain_fallback_rate}`,
        actual: outDomainFallbackRate.toFixed(3),
      });
    }
  } else if (typeof thresholds.global.min_out_domain_fallback_rate === 'number') {
    checks.push({
      name: 'out_domain_fallback_rate',
      ok: false,
      expected: `>= ${thresholds.global.min_out_domain_fallback_rate}`,
      actual: 'not evaluated (run with --include-chat)',
    });
  }

  const decision: EvalReport['decision'] = checks.every((c) => c.ok) ? 'GO' : 'NO-GO';
  console.log(`decision: ${decision}`);

  const report: EvalReport = {
    generated_at: new Date().toISOString(),
    dataset_path: opts.datasetPath,
    thresholds_path: opts.thresholdsPath,
    output_path: opts.outputPath,
    params: {
      k: opts.k,
      retrieval_threshold: opts.retrievalThreshold,
      include_chat: opts.includeChat,
      enforce: opts.enforce,
    },
    cases: {
      total: dataset.length,
      in_domain: inDomain.length,
      out_of_domain: outDomain.length,
    },
    metrics: {
      hit_at_k: hitAtK,
      mrr_at_k: mrr,
      out_domain_fallback_rate: outDomainFallbackRate,
      by_domain: domainOutput,
    },
    checks,
    decision,
  };

  const outDir = path.dirname(opts.outputPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(opts.outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`report: ${opts.outputPath}`);

  if (opts.enforce && decision === 'NO-GO') {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('[rag:eval] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
