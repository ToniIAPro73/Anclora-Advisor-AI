import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

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

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, maxLength: number = 1200, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxLength;
    if (endIndex < text.length) {
      const lastNewline = text.lastIndexOf('\n', endIndex);
      if (lastNewline > startIndex + maxLength / 2) {
        endIndex = lastNewline;
      } else {
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + maxLength / 2) {
          endIndex = lastSpace;
        }
      }
    }
    chunks.push(text.slice(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
    if (startIndex < 0) startIndex = 0;
    if (endIndex >= text.length) break;
  }

  return chunks.filter(c => c.length > 50);
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
      const chunks = chunkText(normalizedContent);
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
