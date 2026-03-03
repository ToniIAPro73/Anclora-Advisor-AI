import { createServiceSupabaseClient } from "../src/lib/supabase/server-admin";
import { INVOICE_IMPORTS_BUCKET } from "../src/lib/invoices/imports";

async function main(): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const bucketConfig = {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  };
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === INVOICE_IMPORTS_BUCKET);
  if (exists) {
    const { error: updateError } = await supabase.storage.updateBucket(INVOICE_IMPORTS_BUCKET, bucketConfig);
    if (updateError) {
      throw new Error(updateError.message);
    }
    console.log(`[APPLY] Bucket '${INVOICE_IMPORTS_BUCKET}' updated successfully.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(INVOICE_IMPORTS_BUCKET, bucketConfig);

  if (createError) {
    throw new Error(createError.message);
  }

  console.log(`[APPLY] Bucket '${INVOICE_IMPORTS_BUCKET}' created successfully.`);
}

main().catch((error) => {
  console.error("[APPLY] ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
