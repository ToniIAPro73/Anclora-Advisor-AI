/**
 * Agent C — Targeted Reingest + Embedding Script
 * Feature: ANCLORA-RAG-INGEST-001
 *
 * Reads scripts/notebook_bundle_v1_patch.json
 * For each source in the patch:
 *   1. Upsert rag_documents (by title + source_url)
 *   2. DELETE all rag_chunks for that document_id  (full replacement)
 *   3. Re-chunk content and INSERT new chunks (embedding = null)
 * Then generates embeddings for all pending chunks in the patched docs.
 *
 * Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2  (384-dim)
 * No OpenAI usage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── Env Preflight ────────────────────────────────────────────────────────────
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ PREFLIGHT FAILED: Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

// Validate project_ref coherence
const publicRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(
  /https:\/\/([^.]+)\.supabase\.co/
)?.[1];
const serverRef = (process.env.SUPABASE_URL || '').match(
  /https:\/\/([^.]+)\.supabase\.co/
)?.[1];

if (publicRef !== serverRef) {
  console.error(
    `❌ PREFLIGHT FAILED: ENV_MISMATCH — NEXT_PUBLIC_SUPABASE_URL ref (${publicRef}) !== SUPABASE_URL ref (${serverRef}). NO-GO.`
  );
  process.exit(1);
}

console.log(`✅ PREFLIGHT PASSED — project_ref: ${publicRef}`);

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatchSource {
  source_id: string;
  notebook_id: string;
  domain: string;
  title: string;
  url: string | null;
  source_type: string;
  char_count: number;
  placeholder_count: number;
  content: string;
}

interface PatchNotebook {
  notebook_id: string;
  notebook_title: string;
  domain: string;
  patch_type: string;
  sources: PatchSource[];
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
  if (haystack.includes('marca') || haystack.includes('posicionamiento')) return 'posicionamiento';
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

// ─── Text Utilities ───────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

function chunkText(
  text: string,
  maxLength: number = 1200,
  overlap: number = 200
): string[] {
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

  return chunks.filter((c) => c.length > 50);
}

// ─── Validation Helpers ───────────────────────────────────────────────────────
function countPlaceholders(content: string): number {
  const patterns = [
    /\[CONTENIDO NO DISPONIBLE\]/gi,
    /\[PLACEHOLDER\]/gi,
    /lorem ipsum/gi,
    /\[TODO\]/gi,
    /CONTENT_UNAVAILABLE/gi,
  ];
  return patterns.reduce((acc, p) => acc + (content.match(p) || []).length, 0);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const bundlePath = path.join(
    process.cwd(),
    'scripts',
    'notebook_bundle_v1_patch.json'
  );

  if (!fs.existsSync(bundlePath)) {
    console.error(`❌ Patch bundle not found at ${bundlePath}`);
    process.exit(1);
  }

  const notebooks: PatchNotebook[] = JSON.parse(
    fs.readFileSync(bundlePath, 'utf8')
  );

  console.log(`\n📦 Patch bundle loaded — ${notebooks.length} notebook(s)`);

  // ── Step 1: Validate patch bundle (no placeholders) ─────────────────────────
  console.log('\n🔍 Step 1: Validating patch bundle integrity...');
  let bundleValid = true;
  for (const nb of notebooks) {
    for (const src of nb.sources) {
      const pCount = countPlaceholders(src.content);
      if (pCount > 0 || src.placeholder_count > 0) {
        console.error(
          `   ❌ PLACEHOLDER DETECTED in "${src.title}": placeholder_count=${src.placeholder_count}, regex_count=${pCount}`
        );
        bundleValid = false;
      }
    }
  }
  if (!bundleValid) {
    console.error('❌ Patch bundle has placeholders. NO-GO.');
    process.exit(1);
  }
  console.log('   ✅ All sources: placeholder_count = 0');

  // ── Step 2: Count pending before ────────────────────────────────────────────
  const { count: pendingBefore } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);
  console.log(`\n📊 pending_before = ${pendingBefore ?? 0}`);

  // ── Step 3: Targeted reingest ────────────────────────────────────────────────
  console.log('\n🔄 Step 3: Targeted reingest...');
  let updatedDocCount = 0;
  let newChunkTotal = 0;
  const patchedDocIds: string[] = [];

  for (const nb of notebooks) {
    console.log(
      `\n   📒 Notebook: ${nb.notebook_title} [${nb.domain}] — patch_type: ${nb.patch_type}`
    );

    for (const src of nb.sources) {
      const sUrl = src.url ?? '';
      console.log(`\n   📄 Source: "${src.title}"`);
      console.log(`      char_count: ${src.char_count}`);

      // 3a. Upsert document
      const { data: existingDoc } = await supabase
        .from('rag_documents')
        .select('id')
        .eq('title', src.title)
        .eq('source_url', sUrl)
        .maybeSingle();

      let docId: string;

      if (existingDoc) {
        docId = existingDoc.id;
        console.log(`      💡 Document exists (ID: ${docId.slice(0, 8)}...)`);
      } else {
        const { data: newDoc, error: insertErr } = await supabase
          .from('rag_documents')
          .insert({
            title: src.title,
            category: nb.domain,
            source_url: sUrl,
            doc_metadata: {
              notebook_id: nb.notebook_id,
              notebook_title: nb.notebook_title,
              source_type: src.source_type,
              jurisdiction: inferJurisdiction(src.title, sUrl, nb.domain),
              topic: inferTopic(src.title, nb.domain),
            },
          })
          .select()
          .single();

        if (insertErr || !newDoc) {
          console.error(
            `      ❌ Error inserting document: ${insertErr?.message}`
          );
          continue;
        }
        docId = newDoc.id;
        console.log(
          `      ✅ New document created (ID: ${docId.slice(0, 8)}...)`
        );
      }

      patchedDocIds.push(docId);
      updatedDocCount++;

      // 3b. Delete existing chunks (full replacement)
      const { error: deleteErr, count: deletedCount } = await supabase
        .from('rag_chunks')
        .delete({ count: 'exact' })
        .eq('document_id', docId);

      if (deleteErr) {
        console.error(
          `      ❌ Error deleting existing chunks: ${deleteErr.message}`
        );
        continue;
      }
      console.log(
        `      🗑️  Deleted ${deletedCount ?? 0} old chunk(s) for this document.`
      );

      // 3c. Re-chunk and insert
      const normalized = normalizeText(src.content);
      const chunks = chunkText(normalized);
      console.log(`      ✨ Generated ${chunks.length} new chunk(s)`);

      const { error: chunkErr } = await supabase.from('rag_chunks').insert(
        chunks.map((content) => ({
          document_id: docId,
          content,
          embedding: null,
          token_count: Math.ceil(content.length / 4),
        }))
      );

      if (chunkErr) {
        console.error(`      ❌ Error inserting chunks: ${chunkErr.message}`);
      } else {
        newChunkTotal += chunks.length;
        console.log(
          `      ✅ ${chunks.length} new chunks inserted (pending embeddings).`
        );
      }
    }
  }

  console.log(
    `\n📊 Reingest summary: ${updatedDocCount} docs processed, ${newChunkTotal} chunks created.`
  );

  // ── Step 4: Generate embeddings for patched docs ─────────────────────────────
  console.log('\n🤖 Step 4: Generating embeddings for patched chunks...');
  console.log(
    '   Initializing local pipeline: Xenova/paraphrase-multilingual-MiniLM-L12-v2'
  );
  const embedder = await pipeline(
    'feature-extraction',
    'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
  );
  console.log('   ✅ Pipeline ready.');

  // Fetch only pending chunks for patched documents
  const { data: pendingChunks, error: fetchErr } = await supabase
    .from('rag_chunks')
    .select('id, content, document_id')
    .in('document_id', patchedDocIds)
    .is('embedding', null);

  if (fetchErr) {
    console.error('❌ Error fetching pending chunks:', fetchErr.message);
    process.exit(1);
  }

  if (!pendingChunks || pendingChunks.length === 0) {
    console.log('   ✅ No pending chunks found for patched docs.');
  } else {
    console.log(
      `   📝 ${pendingChunks.length} chunk(s) to embed for patched docs.`
    );
    let embeddedCount = 0;
    let badDimCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingChunks.length; i++) {
      const chunk = pendingChunks[i];
      process.stdout.write(
        `\r   🌀 Embedding chunk ${i + 1}/${pendingChunks.length} (ID: ${chunk.id.slice(0, 8)}...)    `
      );

      try {
        const output = await embedder(chunk.content, {
          pooling: 'mean',
          normalize: true,
        });
        const embedding = Array.from(output.data as number[]);

        if (embedding.length !== 384) {
          console.error(
            `\n      ❌ Dimension mismatch! Expected 384, got ${embedding.length}`
          );
          badDimCount++;
          continue;
        }

        const { error: updateErr } = await supabase
          .from('rag_chunks')
          .update({ embedding })
          .eq('id', chunk.id);

        if (updateErr) {
          console.error(`\n      ❌ Update failed: ${updateErr.message}`);
          errorCount++;
        } else {
          embeddedCount++;
        }
      } catch (e) {
        console.error(`\n      ❌ Embedding failed:`, e);
        errorCount++;
      }
    }

    console.log(`\n\n   embedded: ${embeddedCount}`);
    console.log(`   bad_dim_count: ${badDimCount}`);
    console.log(`   errors: ${errorCount}`);
  }

  // ── Step 5: Final validation ──────────────────────────────────────────────────
  console.log('\n🏁 Step 5: Final Validation...');

  // pending_after (global)
  const { count: pendingAfter } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  // bad dims for patched docs
  const { data: patchedWithEmbeddings } = await supabase
    .from('rag_chunks')
    .select('id, embedding')
    .in('document_id', patchedDocIds)
    .not('embedding', 'is', null);

  let badDimValidation = 0;
  if (patchedWithEmbeddings) {
    for (const row of patchedWithEmbeddings) {
      // Supabase returns vector columns as a JSON string "[0.1, 0.2, ...]"
      let emb = row.embedding;
      if (typeof emb === 'string') {
        try { emb = JSON.parse(emb); } catch { emb = null; }
      }
      const dim = Array.isArray(emb) ? (emb as number[]).length : -1;
      if (dim !== 384) badDimValidation++;
    }
  }

  // placeholder chunks check for patched docs
  let placeholderChunksDetected = 0;
  const { data: patchedChunks } = await supabase
    .from('rag_chunks')
    .select('content')
    .in('document_id', patchedDocIds);

  if (patchedChunks) {
    for (const row of patchedChunks) {
      if (countPlaceholders(row.content) > 0) {
        placeholderChunksDetected++;
      }
    }
  }

  // updated_count
  const { count: updatedCount } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .in('document_id', patchedDocIds);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 VALIDATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   pending_before              : ${pendingBefore ?? 0}`);
  console.log(`   updated_count (patched docs): ${updatedCount ?? 0}`);
  console.log(`   pending_after (global)      : ${pendingAfter ?? 0}`);
  console.log(`   bad_dim_count               : ${badDimValidation}`);
  console.log(`   placeholder_chunks_detected : ${placeholderChunksDetected}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const validationPassed =
    (pendingAfter ?? 0) === 0 &&
    badDimValidation === 0 &&
    placeholderChunksDetected === 0;

  if (validationPassed) {
    console.log(
      '\n✅ ALL VALIDATIONS PASSED — Agent C COMPLETE. Ready for Agent D handoff.'
    );
  } else {
    console.error('\n❌ VALIDATION FAILED:');
    if ((pendingAfter ?? 0) > 0)
      console.error(`   - pending_after = ${pendingAfter} (expected 0)`);
    if (badDimValidation > 0)
      console.error(
        `   - bad_dim_count = ${badDimValidation} (expected 0)`
      );
    if (placeholderChunksDetected > 0)
      console.error(
        `   - placeholder_chunks_detected = ${placeholderChunksDetected} (expected 0)`
      );
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
