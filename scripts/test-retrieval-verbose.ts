import { retrieveContext } from '../src/lib/rag/retrieval';
import { generateEmbeddingVector } from '../src/lib/ai/runtime';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
  const query = 'qué gastos puedo deducirme de mi actividad como autónomo en las islas baleares?';
  console.log(`Testing query: "${query}"`);
  
  // 1. generate check
  try {
     const vec = await generateEmbeddingVector(query);
     console.log('Vec size:', vec.length);
  } catch (e) {
     console.error('Vector generation failed:', e);
  }
  
  const result = await retrieveContext(query, { category: 'fiscal' });
  console.log('Final chunks retrieved:', result.chunks.length);
  if (result.chunks.length > 0) {
    for (let i = 0; i < Math.min(3, result.chunks.length); i++) {
      console.log(`\n--- Match ${i + 1} ---`);
      console.log('Similarity:', result.chunks[i].similarity);
      console.log('Title:', result.chunks[i].metadata.title);
    }
  }
}

test().catch(console.error);
