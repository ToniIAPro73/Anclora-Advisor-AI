import { retrieveWithCascade } from '../lib/agents/orchestrator';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testQuery(query: string, category: 'fiscal' | 'laboral' | 'mercado') {
  console.log(`\n=================================\nTesting [${category}]: "${query}"`);
  
  const result = await retrieveWithCascade(query, category as any, true, false);
  console.log('Chunks retrieved:', result?.chunks?.length || 0);
  if (result && result.chunks.length > 0) {
    for (let i = 0; i < Math.min(2, result.chunks.length); i++) {
      console.log(`\n  --- Match ${i + 1} ---`);
      console.log('  Similarity:', result.chunks[i].similarity);
      console.log('  Title:', result.chunks[i].metadata.title);
      console.log('  Snippet:', result.chunks[i].content.slice(0, 100).replace(/\n/g, ' ') + '...');
    }
  } else {
    console.log('  NO EVIDENCE FOUND');
  }
}

async function runTests() {
  await testQuery('Cuáles son los plazos y requisitos oficiales de la resolución de Cuota Cero en Baleares para 2026?', 'fiscal');
  await testQuery('Qué indica la jurisprudencia específica del TSJ de Baleares (STSJIB) sobre la audiencia previa en el despido disciplinario?', 'laboral');
  await testQuery('Cuáles son los requisitos legales exactos, seguros necesarios y las sanciones del ROAIIB fijados en la ley para 2026?', 'mercado');
}

runTests().catch(console.error);
