/**
 * scripts/verify-rag-infra.ts
 * Verifies RAG infra required by retrieval/chat grounding.
 * Run: npx tsx scripts/verify-rag-infra.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

function parseEmbeddingDim(value: unknown): number {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value !== 'string') return 0;
  const cleaned = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!cleaned) return 0;
  return cleaned.split(',').length;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !key) {
    console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const checks: Check[] = [];

  const docRes = await supabase.from('rag_documents').select('id', { count: 'exact', head: true });
  checks.push({
    name: 'rag_documents table',
    ok: !docRes.error,
    detail: docRes.error ? docRes.error.message : `count=${docRes.count ?? 0}`,
  });

  const chunkRes = await supabase.from('rag_chunks').select('id', { count: 'exact', head: true });
  checks.push({
    name: 'rag_chunks table',
    ok: !chunkRes.error,
    detail: chunkRes.error ? chunkRes.error.message : `count=${chunkRes.count ?? 0}`,
  });

  const sampleRes = await supabase
    .from('rag_chunks')
    .select('embedding')
    .not('embedding', 'is', null)
    .limit(1);
  const sampleDim = sampleRes.data?.[0]?.embedding
    ? parseEmbeddingDim(sampleRes.data[0].embedding)
    : 0;
  checks.push({
    name: 'embedding dimension sample',
    ok: !sampleRes.error && (sampleDim === 384 || sampleDim === 0),
    detail: sampleRes.error ? sampleRes.error.message : `dim=${sampleDim || 'no-sample'}`,
  });

  const zero = new Array<number>(384).fill(0);
  const rpcRes = await supabase.rpc('match_chunks', {
    query_embedding: zero,
    match_threshold: 0.0,
    match_count: 1,
    filter_category: '',
  });
  checks.push({
    name: 'match_chunks RPC',
    ok: !rpcRes.error,
    detail: rpcRes.error ? `${rpcRes.error.code}: ${rpcRes.error.message}` : 'available',
  });

  console.log('\n=== RAG Infra Verification ===\n');
  for (const check of checks) {
    const icon = check.ok ? 'OK ' : 'FAIL';
    console.log(`${icon} ${check.name} -> ${check.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.log('\nDecision: NO-GO (infra missing or inconsistent)');
    process.exit(1);
  }

  console.log('\nDecision: GO (RAG infra ready)');
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

