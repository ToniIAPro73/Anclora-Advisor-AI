// scripts/seed-rag-test.ts
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🚀 Seeding test RAG data...');
  
  const embedder = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');

  const { data: doc, error: docError } = await supabase
    .from('rag_documents')
    .insert([
      { title: 'Normativa RETA 2025', category: 'fiscal', source_url: 'https://example.com/reta2025' }
    ])
    .select()
    .single();

  if (docError) {
    console.error('Error creating document:', docError);
    return;
  }

  const chunks = [
    "Los autónomos que inicien su actividad en 2025 podrán solicitar la cuota cero durante el primer año en comunidades como Madrid o Andalucía.",
    "La pluriactividad permite compatibilizar el trabajo por cuenta ajena con el trabajo por cuenta propia, con bonificaciones en las cuotas de la Seguridad Social.",
    "El tope de base de cotización para autónomos en 2025 se ajustará según la evolución del IPC y los nuevos tramos de ingresos reales."
  ];

  for (const content of chunks) {
    const output = await embedder(content, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    const { error: chunkError } = await supabase
      .from('rag_chunks')
      .insert({
        document_id: doc.id,
        content,
        embedding
      });

    if (chunkError) {
      console.error('Error creating chunk:', chunkError);
    }
  }

  console.log('✅ Seed complete!');
}

seed().catch(console.error);
