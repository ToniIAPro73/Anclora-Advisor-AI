/**
 * scripts/apply-match-chunks-rpc.ts
 * Applies match_chunks RPC via direct Postgres connection to the Supabase DB.
 * Run: npx tsx scripts/apply-match-chunks-rpc.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Client } from 'pg';

const SQL = `
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_category text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    jsonb_build_object(
      'title',      rd.title,
      'category',   rd.category,
      'source_url', rd.source_url
    ) AS metadata,
    1 - (rc.embedding <=> query_embedding::vector) AS similarity
  FROM rag_chunks rc
  JOIN rag_documents rd ON rc.document_id = rd.id
  WHERE 1 - (rc.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_category IS NULL OR filter_category = '' OR rd.category = filter_category)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
`;

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const ref = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  if (!ref) {
    console.error('[APPLY] Missing SUPABASE_URL in .env.local');
    process.exit(1);
  }

  // Supabase direct Postgres connection (port 5432, session mode)
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_SERVICE_ROLE_KEY, // service role acts as postgres
    ssl: { rejectUnauthorized: false },
  });

  console.log(`[APPLY] Connecting to db.${ref}.supabase.co...`);

  try {
    await client.connect();
    console.log('[APPLY] Connected. Applying migration...');
    await client.query(SQL);
    console.log('[APPLY] ✓ match_chunks RPC created/updated successfully.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[APPLY] ✗ Failed:', msg);
    console.log('\n[APPLY] Please apply the SQL manually via the Supabase SQL Editor:');
    console.log('  File: supabase/migrations/20260227_match_chunks_rpc.sql');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
