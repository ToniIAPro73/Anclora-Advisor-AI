/**
 * tests/test-retrieval-d.ts
 * Agent D — Integration test: retrieval, domain routing, citations, no-hallucination
 *
 * Run: npx tsx tests/test-retrieval-d.ts
 * Requires: .env.local in project root (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { retrieveContext } from '../src/lib/rag/retrieval';
import { Orchestrator } from '../lib/agents/orchestrator';

const GREEN  = '\x1b[32m✓\x1b[0m';
const RED    = '\x1b[31m✗\x1b[0m';
const YELLOW = '\x1b[33m⚠\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ${GREEN} ${label}`);
    passed++;
  } else {
    console.log(`  ${RED} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runTests(): Promise<void> {
  console.log('\n=== Agent D — Retrieval Integration Tests ===\n');

  const orchestrator = new Orchestrator();
  const CONV_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = 'test-agent-d';

  // ── T1: Fiscal retrieval ──────────────────────────────────────
  console.log('T1 — Fiscal: "¿Cuáles son los plazos del IVA?"');
  {
    const chunks = await retrieveContext('¿Cuáles son los plazos del IVA?', {
      category: 'fiscal', threshold: 0.35, limit: 5,
    });
    assert(chunks.length > 0,           'At least 1 chunk returned', `got ${chunks.length}`);
    assert(
      chunks.every(c => c.metadata.category === 'fiscal'),
      'All chunks belong to category fiscal',
      chunks.map(c => c.metadata.category).join(', ')
    );
    assert(chunks[0].similarity >= 0.35, `Top similarity ≥ 0.35 (got ${chunks[0]?.similarity?.toFixed(2)})`);
    if (chunks.length > 0) {
      console.log(`    Top chunk: "${chunks[0].metadata.title}" (${(chunks[0].similarity * 100).toFixed(1)}%)`);
    }
  }

  // ── T2: Laboral retrieval ─────────────────────────────────────
  console.log('\nT2 — Laboral: "¿Qué riesgos tiene la pluriactividad?"');
  {
    const chunks = await retrieveContext('¿Qué riesgos tiene la pluriactividad?', {
      category: 'labor', threshold: 0.35, limit: 5,
    });
    assert(chunks.length > 0, 'At least 1 chunk returned', `got ${chunks.length}`);
    if (chunks.length > 0) {
      console.log(`    Top chunk: "${chunks[0].metadata.title}" (${(chunks[0].similarity * 100).toFixed(1)}%)`);
    }
  }

  // ── T3: Mercado/Marca retrieval ───────────────────────────────
  console.log('\nT3 — Mercado/Marca: "¿Cómo definir una USP en marca personal inmobiliaria premium?"');
  {
    const chunks = await retrieveContext('¿Cómo definir una USP en marca personal inmobiliaria premium?', {
      category: 'market', threshold: 0.30, limit: 5,
    });
    assert(chunks.length > 0, 'At least 1 chunk returned', `got ${chunks.length}`);
    if (chunks.length > 0) {
      console.log(`    Top chunk: "${chunks[0].metadata.title}" (${(chunks[0].similarity * 100).toFixed(1)}%)`);
    }
  }

  // ── T4: No-hallucination fallback ─────────────────────────────
  console.log('\nT4 — No alucinación: "¿Quién ganó el mundial de fútbol en 1930?"');
  {
    const resp = await orchestrator.processQuery(USER_ID, CONV_ID, '¿Quién ganó el mundial de fútbol en 1930?');
    assert(resp.groundingConfidence === 'none', `groundingConfidence = 'none' (got '${resp.groundingConfidence}')`);
    assert(resp.citations.length === 0, `No citations returned (got ${resp.citations.length})`);
    const noInvention = !resp.primarySpecialistResponse.toLowerCase().includes('uruguay');
    assert(noInvention, 'Response does not hallucinate the answer');
    console.log(`    Response snippet: "${resp.primarySpecialistResponse.slice(0, 120)}..."`);
  }

  // ── T5: Grounded response has citations ───────────────────────
  console.log('\nT5 — Citations: "¿Qué es la cuota cero para autónomos en 2025?"');
  {
    const resp = await orchestrator.processQuery(USER_ID, CONV_ID, '¿Qué es la cuota cero para autónomos en 2025?');
    const hasInlineCitation = resp.primarySpecialistResponse.includes('[1]');
    const hasFuentesSection = resp.primarySpecialistResponse.includes('Fuentes consultadas');

    if (resp.groundingConfidence !== 'none') {
      assert(resp.citations.length >= 1, `At least 1 citation (got ${resp.citations.length})`);
      assert(hasInlineCitation, 'Response contains inline [1] citation');
      assert(hasFuentesSection, 'Response contains "Fuentes consultadas" section');
      console.log(`    Citations: ${resp.citations.map(c => `[${c.index}] ${c.title}`).join(', ')}`);
    } else {
      console.log(`    ${YELLOW} No chunks found for this query — T5 grounding check skipped.`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log(`Results: ${GREEN} ${passed} passed  ${failed > 0 ? RED : ''}${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('\n[FATAL] Test runner crashed:', err);
  process.exit(1);
});
