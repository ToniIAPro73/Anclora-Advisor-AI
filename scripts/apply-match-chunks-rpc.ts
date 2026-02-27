/**
 * scripts/apply-match-chunks-rpc.ts
 * Applies the full RAG infra migration via direct Postgres connection.
 * Run: npx tsx scripts/apply-match-chunks-rpc.ts
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20260227_rag_infra_hardening.sql'
);

function getConnectionString(): string {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? '';
}

async function main(): Promise<void> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('[APPLY] Missing SUPABASE_DB_URL/DATABASE_URL in .env.local');
    console.error('[APPLY] Use the direct Postgres connection string from Supabase > Connect > Session pooler.');
    process.exit(1);
  }

  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`[APPLY] Migration file not found: ${MIGRATION_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('[APPLY] Connecting to Supabase Postgres...');
    await client.connect();
    console.log('[APPLY] Connected. Applying migration bundle...');
    await client.query(sql);
    console.log('[APPLY] OK - RAG infra migration applied successfully.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[APPLY] ERROR:', msg);
    console.log('\n[APPLY] Apply manually in Supabase SQL Editor using:');
    console.log('  supabase/migrations/20260227_rag_infra_hardening.sql');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

