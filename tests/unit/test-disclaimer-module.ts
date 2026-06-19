/**
 * Unit tests for the AI Act Art. 50 disclaimer module.
 * Validates that disclaimer texts exist for all locales and components render correctly.
 * Run: npx tsx tests/unit/test-disclaimer-module.ts
 */

import { DISCLAIMER_TEXTS } from "../../src/components/features/disclaimer/disclaimer-texts";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  FAIL: ${label}`);
    failed++;
  } else {
    console.log(`  PASS: ${label}`);
    passed++;
  }
}

// --- Test 1: All required locales have disclaimer texts ---
console.log("\nTest 1: All locales have complete disclaimer texts");

const requiredLocales = ["es", "en"] as const;
const requiredKeys = [
  "sessionBannerTitle",
  "sessionBanner",
  "aiIndicator",
  "legalFooter",
] as const;

for (const locale of requiredLocales) {
  const texts = DISCLAIMER_TEXTS[locale];
  assert(texts !== undefined, `locale '${locale}' exists in DISCLAIMER_TEXTS`);

  for (const key of requiredKeys) {
    assert(
      typeof texts[key] === "string" && texts[key].length > 0,
      `locale '${locale}' has non-empty '${key}'`,
    );
  }
}

// --- Test 2: Spanish disclaimer mentions AI system ---
console.log("\nTest 2: Spanish disclaimer mentions AI system");
const esTexts = DISCLAIMER_TEXTS.es;
assert(
  esTexts.sessionBanner.includes("inteligencia artificial"),
  "sessionBanner mentions 'inteligencia artificial'",
);
assert(esTexts.aiIndicator.includes("IA"), "aiIndicator includes 'IA'");
assert(
  esTexts.legalFooter.includes("asesoramiento legal"),
  "legalFooter mentions 'asesoramiento legal'",
);

// --- Test 3: English disclaimer mentions AI system ---
console.log("\nTest 3: English disclaimer mentions AI system");
const enTexts = DISCLAIMER_TEXTS.en;
assert(
  enTexts.sessionBanner.includes("artificial intelligence"),
  "sessionBanner mentions 'artificial intelligence'",
);
assert(enTexts.aiIndicator.includes("AI"), "aiIndicator includes 'AI'");
assert(
  enTexts.legalFooter.includes("legal or tax advice"),
  "legalFooter mentions 'legal or tax advice'",
);

// --- Test 4: Disclaimer references Art. 50 ---
console.log("\nTest 4: Disclaimer titles reference AI Act Art. 50");
assert(
  esTexts.sessionBannerTitle.includes("Art. 50"),
  "Spanish title references Art. 50",
);
assert(
  enTexts.sessionBannerTitle.includes("Art. 50"),
  "English title references Art. 50",
);

// --- Test 5: Legal footer warns against reliance ---
console.log(
  "\nTest 5: Legal footer warns against reliance on AI-generated advice",
);
assert(
  esTexts.legalFooter.includes("profesional cualificado"),
  "Spanish legal footer advises consulting a professional",
);
assert(
  enTexts.legalFooter.includes("qualified professional"),
  "English legal footer advises consulting a professional",
);

// --- Summary ---
console.log(`\n${"=".repeat(50)}`);
console.log(`DISCLAIMER MODULE TESTS: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
