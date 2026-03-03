import { retrieveWithCascade } from '../lib/agents/orchestrator';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
  const query = 'qué gastos puedo deducirme de mi actividad como autónomo en las islas baleares?';
  console.log(`Testing query: "${query}"`);
  
  const result = await retrieveWithCascade(query, 'fiscal', true, false);
  console.log('Final chunks retrieved via Cascade:', result?.chunks?.length);
  if (result && result.chunks.length > 0) {
    for (let i = 0; i < Math.min(3, result.chunks.length); i++) {
      console.log(`\n--- Match ${i + 1} ---`);
      console.log('Similarity:', result.chunks[i].similarity);
      console.log('Title:', result.chunks[i].metadata.title);
    }
  }
}

test().catch(console.error);
