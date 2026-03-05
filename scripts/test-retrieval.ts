import { retrieveContext } from '../src/lib/rag/retrieval';

async function test() {
  const query = 'qué gastos puedo deducirme de mi actividad como autónomo en las islas baleares?';
  console.log(`Testing query: "${query}"`);
  
  const result = await retrieveContext(query);
  
  console.log('Chunks retrieved:', result.chunks.length);
  if (result.chunks.length > 0) {
    for (let i = 0; i < Math.min(3, result.chunks.length); i++) {
      console.log(`\n--- Match ${i + 1} ---`);
      console.log('Similarity:', result.chunks[i].similarity);
      console.log('Title:', result.chunks[i].metadata.title);
      console.log('Content preview:', result.chunks[i].content.slice(0, 150) + '...');
    }
  }
}

test().catch(console.error);
