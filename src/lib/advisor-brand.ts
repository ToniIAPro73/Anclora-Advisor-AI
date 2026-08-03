export const ADVISOR_BRAND = {
  name: 'Anclora Advisor AI',
  description: 'Plataforma de asesoramiento fiscal, laboral y de mercado para autónomos — Anclora Group',
  family: 'Internal',
  role: 'internal-baseline',

  // Typography (ANCLORA_BRANDING_TYPOGRAPHY — familia Internas: Inter + JetBrains Mono)
  displayFont: 'Inter',
  bodyFont: 'Inter',
  monoFont: 'JetBrains Mono',

  // Colors — ANCLORA_BRANDING_COLOR_TOKENS (advisor)
  primaryColor: '#162944',    // Navy — interior del icono canónico
  accentColor: '#1dab89',     // Teal — acento contractual
  accentDim: '#17987a',       // Teal dim
  darkCanvas: '#1c2b3c',      // Dark canvas
  lightCanvas: '#f3f6fb',     // Light canvas

  // Assets
  logoPath: '/brand/anclora-advisor-ai.png',
  faviconPath: '/brand/favicon.ico',
  faviconPng32: '/brand/favicon-32.png',
  faviconPng192: '/brand/favicon-192.png',
  faviconPng512: '/brand/favicon-512.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',

  // App preferences (Internal baseline contract)
  supportedThemes: ['dark', 'light', 'system'] as const,
  supportedLanguages: ['es', 'en'] as const,

  // Component system
  componentPrefix: 'advisor-',
  assetPrefix: 'advisor_',
} as const
