import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RagDocumentRow {
  id: string;
  title: string;
  category: string | null;
  source_url: string | null;
  doc_metadata: Record<string, unknown> | null;
}

function inferTopic(title: string, category: string): string | null {
  const haystack = `${title} ${category}`.toLowerCase();
  if (haystack.includes('cuota cero')) return 'cuota_cero';
  if (haystack.includes('iva') || haystack.includes('modelo 303')) return 'iva';
  if (haystack.includes('irpf') || haystack.includes('modelo 130')) return 'irpf';
  if (haystack.includes('reta')) return 'reta';
  if (haystack.includes('pluriactividad')) return 'pluriactividad';
  if (haystack.includes('despido')) return 'despido';
  if (haystack.includes('fianza') || haystack.includes('alquiler') || haystack.includes('arrend')) return 'arrendamiento';
  if (haystack.includes('marca') || haystack.includes('posicionamiento')) return 'posicionamiento';
  return null;
}

function inferJurisdiction(title: string, sourceUrl: string | null, category: string | null): string {
  const haystack = `${title} ${sourceUrl ?? ''}`.toLowerCase();
  if (haystack.includes('baleares') || haystack.includes('balears') || haystack.includes('mallorca') || haystack.includes('caib.es')) {
    return 'es-bal';
  }
  if (category === 'fiscal' || category === 'laboral' || category === 'mercado') {
    return 'es';
  }
  return 'unknown';
}

function inferSourceType(sourceUrl: string | null): string {
  return sourceUrl && sourceUrl.trim().length > 0 ? 'web_page' : 'generated_text';
}

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('id, title, category, source_url, doc_metadata');

  if (error || !data) {
    console.error('Failed to fetch rag_documents:', error?.message);
    process.exit(1);
  }

  let updated = 0;
  for (const row of data as RagDocumentRow[]) {
    const nextMetadata = {
      ...(row.doc_metadata ?? {}),
      source_type: inferSourceType(row.source_url),
      jurisdiction: inferJurisdiction(row.title, row.source_url, row.category),
      topic: inferTopic(row.title, row.category ?? ''),
    };

    const { error: updateError } = await supabase
      .from('rag_documents')
      .update({ doc_metadata: nextMetadata })
      .eq('id', row.id);

    if (updateError) {
      console.error(`Failed updating ${row.id}: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`Updated metadata for ${updated} rag_documents.`);
}

main().catch((error) => {
  console.error('[backfill-rag-metadata] failed:', error);
  process.exit(1);
});
