import { ADVISOR_BRAND } from '../../src/lib/advisor-brand'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ ${message}`)
    failed++
  }
}

console.log('\nadvisor-ai branding contract\n')

assert(ADVISOR_BRAND.name === 'Anclora Advisor AI', 'name is canonical')
assert(ADVISOR_BRAND.family === 'Internal', 'family is Internal')
assert(ADVISOR_BRAND.role === 'internal-baseline', 'role is internal-baseline')
assert(ADVISOR_BRAND.displayFont === 'Cormorant Garamond', 'display font is Cormorant Garamond')
assert(ADVISOR_BRAND.bodyFont === 'Source Sans 3', 'body font is Source Sans 3')
assert(ADVISOR_BRAND.logoPath === '/brand/Logo-Advisor_2.png', 'logo path is set')
assert(ADVISOR_BRAND.componentPrefix === 'advisor-', 'component prefix is advisor-')
assert(ADVISOR_BRAND.assetPrefix === 'advisor_', 'asset prefix is advisor_')
assert(ADVISOR_BRAND.supportedThemes.includes('dark'), 'supports dark theme')
assert(ADVISOR_BRAND.supportedThemes.includes('light'), 'supports light theme')
assert(ADVISOR_BRAND.supportedThemes.includes('system'), 'supports system theme')
assert(ADVISOR_BRAND.supportedLanguages.includes('es'), 'supports Spanish')
assert(ADVISOR_BRAND.supportedLanguages.includes('en'), 'supports English')

console.log(`\n${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
