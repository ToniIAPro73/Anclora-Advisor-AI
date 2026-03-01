import { createServiceSupabaseClient } from "../src/lib/supabase/server-admin";
import { LABOR_EVIDENCE_BUCKET } from "../src/lib/labor/evidence";

async function main(): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === LABOR_EVIDENCE_BUCKET);
  if (exists) {
    console.log(`[APPLY] Bucket '${LABOR_EVIDENCE_BUCKET}' already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(LABOR_EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
    ],
  });

  if (createError) {
    throw new Error(createError.message);
  }

  console.log(`[APPLY] Bucket '${LABOR_EVIDENCE_BUCKET}' created successfully.`);
}

main().catch((error) => {
  console.error("[APPLY] ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
