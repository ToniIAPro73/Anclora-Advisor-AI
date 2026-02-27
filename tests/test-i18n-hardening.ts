import { I18N_MESSAGES } from "../src/lib/i18n/messages";

function getKeys(dict: Record<string, string>): string[] {
  return Object.keys(dict).sort();
}

function diff(base: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return base.filter((k) => !targetSet.has(k));
}

async function main(): Promise<void> {
  const esKeys = getKeys(I18N_MESSAGES.es);
  const enKeys = getKeys(I18N_MESSAGES.en);

  const missingInEn = diff(esKeys, enKeys);
  const missingInEs = diff(enKeys, esKeys);

  console.log("=== I18N Hardening Check ===");
  console.log(`es keys: ${esKeys.length}`);
  console.log(`en keys: ${enKeys.length}`);

  if (missingInEn.length > 0 || missingInEs.length > 0) {
    console.error("I18N_MISSING_KEYS detected");
    if (missingInEn.length > 0) console.error("Missing in en:", missingInEn.join(", "));
    if (missingInEs.length > 0) console.error("Missing in es:", missingInEs.join(", "));
    process.exit(1);
  }

  console.log("I18N_MISSING_KEYS: none");
}

main().catch((error) => {
  console.error("i18n test failed:", error);
  process.exit(1);
});

