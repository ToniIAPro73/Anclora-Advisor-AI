import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20260228_rag_document_metadata.sql'
);

function getConnectionString(): string {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? '';
}

async function main(): Promise<void> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('[APPLY] Missing SUPABASE_DB_URL/DATABASE_URL in .env.local');
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
    console.log('[APPLY] Connected. Applying doc_metadata migration...');
    await client.query(sql);
    console.log('[APPLY] OK - rag_documents doc_metadata migration applied successfully.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[APPLY] ERROR:', msg);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[APPLY] Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
