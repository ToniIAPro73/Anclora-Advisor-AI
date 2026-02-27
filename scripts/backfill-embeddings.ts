import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Ensure .env.local has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('🚀 Initializing local embedding pipeline...');
  // Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  // Xenova maps this to 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
  const embedder = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');

  console.log('🔍 Checking for pending chunks (embedding IS NULL)...');
  const { data: pendingChunks, error: fetchError } = await supabase
    .from('rag_chunks')
    .select('id, content')
    .is('embedding', null);

  if (fetchError) {
    console.error('❌ Error fetching pending chunks:', fetchError.message);
    return;
  }

  if (!pendingChunks || pendingChunks.length === 0) {
    console.log('✅ No pending chunks found.');
    return;
  }

  console.log(`📝 Found ${pendingChunks.length} chunks to process.`);

  for (let i = 0; i < pendingChunks.length; i++) {
    const chunk = pendingChunks[i];
    console.log(`\n🌀 Processing chunk ${i + 1}/${pendingChunks.length} (ID: ${chunk.id.slice(0, 8)}...)`);

    try {
      // Generate embedding
      // We use pooling: 'mean' and normalize: true to match standard sentence-transformers behavior
      const output = await embedder(chunk.content, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      if (embedding.length !== 384) {
        console.error(`      ❌ Dimension mismatch! Expected 384, got ${embedding.length}`);
        continue;
      }

      // Update chunk
      const { error: updateError } = await supabase
        .from('rag_chunks')
        .update({ embedding })
        .eq('id', chunk.id);

      if (updateError) {
        console.error('      ❌ Update failed:', updateError.message);
      } else {
        console.log('      ✅ Success!');
      }
    } catch (e) {
      console.error('      ❌ Failed:', e);
    }
  }

  // Final Validation
  console.log('\n🏁 Final Validation:');
  const { count: remaining } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  const { data: dimsCheck } = await supabase
    .from('rag_chunks')
    .select('id')
    .not('embedding', 'is', null)
    .limit(1);

  if (dimsCheck && dimsCheck.length > 0) {
     const { data: vectorInfo } = await supabase.rpc('get_vector_dimension', { chunk_id: dimsCheck[0].id });
     console.log(`   - Vector dimension: ${vectorInfo || 'Unknown (Check manually or via RPC)'}`);
  }

  console.log(`   - Pending chunks: ${remaining}`);
  
  if (remaining === 0) {
    console.log('\n✨ Backfill complete! All chunks have valid 384-dim embeddings.');
  } else {
    console.warn(`\n⚠️  Backfill partially complete. ${remaining} chunks still pending.`);
  }
}

run().catch(console.error);
