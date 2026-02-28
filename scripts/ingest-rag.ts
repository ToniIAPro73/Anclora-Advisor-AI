import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { chunkStructuredText, normalizeText } from '../src/lib/rag/chunking';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Ensure .env.local has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Source {
  title: string;
  url: string | null;
  content: string;
}

interface Notebook {
  notebook_id: string;
  notebook_title: string;
  domain: string;
  sources: Source[];
}

function inferTopic(title: string, domain: string): string | null {
  const haystack = `${title} ${domain}`.toLowerCase();
  if (haystack.includes('cuota cero')) return 'cuota_cero';
  if (haystack.includes('iva') || haystack.includes('modelo 303')) return 'iva';
  if (haystack.includes('irpf') || haystack.includes('modelo 130')) return 'irpf';
  if (haystack.includes('reta')) return 'reta';
  if (haystack.includes('pluriactividad')) return 'pluriactividad';
  if (haystack.includes('despido')) return 'despido';
  if (haystack.includes('fianza') || haystack.includes('alquiler') || haystack.includes('arrend')) return 'arrendamiento';
  return null;
}

function inferJurisdiction(title: string, url: string | null, domain: string): string {
  const haystack = `${title} ${url ?? ''}`.toLowerCase();
  if (haystack.includes('baleares') || haystack.includes('balears') || haystack.includes('mallorca') || haystack.includes('caib.es')) {
    return 'es-bal';
  }
  if (['fiscal', 'laboral', 'mercado'].includes(domain)) {
    return 'es';
  }
  return 'unknown';
}

async function run() {
  const bundlePath = path.join(process.cwd(), 'scripts', 'notebook_bundle_v1.json');
  if (!fs.existsSync(bundlePath)) {
    console.error(`Bundle not found at ${bundlePath}`);
    return;
  }

  const notebooks: Notebook[] = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  let totalDocs = 0;
  let totalChunks = 0;

  for (const notebook of notebooks) {
    console.log(`\n📦 Processing Notebook: ${notebook.notebook_title} [${notebook.domain}]`);

    for (const source of notebook.sources) {
      console.log(`   📄 Ingesting Source: ${source.title}`);
      
      const sUrl = source.url || '';

      // Check for existing document
      const { data: existingDoc } = await supabase
        .from('rag_documents')
        .select('id')
        .eq('title', source.title)
        .eq('source_url', sUrl)
        .maybeSingle();

      let docId: string;
      if (existingDoc) {
        docId = existingDoc.id;
        console.log(`      💡 Document already exists (ID: ${docId}).`);
      } else {
        const { data: newDoc, error: insertError } = await supabase
          .from('rag_documents')
          .insert({
            title: source.title,
            category: notebook.domain,
            source_url: sUrl,
            doc_metadata: {
              notebook_id: notebook.notebook_id,
              notebook_title: notebook.notebook_title,
              source_type: sUrl ? 'web_page' : 'generated_text',
              jurisdiction: inferJurisdiction(source.title, sUrl, notebook.domain),
              topic: inferTopic(source.title, notebook.domain),
              chunking_strategy: 'structured_v1',
            },
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(`      ❌ Error inserting document: ${insertError.message}`);
          continue;
        }
        docId = newDoc.id;
        console.log(`      ✅ New document created (ID: ${docId}).`);
      }

      totalDocs++;

      const normalizedContent = normalizeText(source.content);
      const chunks = chunkStructuredText(normalizedContent);
      console.log(`      ✨ Created ${chunks.length} chunks`);

      // Avoid duplicates: check if chunks already exist for this doc
      const { count } = await supabase
        .from('rag_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', docId);

      if (count && count > 0) {
        console.log(`      ⚠️  Chunks already exist for this document (${count}). Skipping insertion.`);
      } else {
        const { error: chunkError } = await supabase
          .from('rag_chunks')
          .insert(chunks.map(content => ({
            document_id: docId,
            content,
            embedding: null, // To be backfilled
            token_count: Math.ceil(content.length / 4)
          })));

        if (chunkError) {
           console.error(`      ❌ Error inserting chunks: ${chunkError.message}`);
        } else {
           totalChunks += chunks.length;
           console.log(`      ✅ ${chunks.length} chunks inserted (pending embeddings).`);
        }
      }
    }
  }

  console.log(`\n✅ Pre-ingestion complete!`);
  console.log(`   Summary: ${totalDocs} documents entries verified, ${totalChunks} chunks inserted.`);
}

run().catch(console.error);
