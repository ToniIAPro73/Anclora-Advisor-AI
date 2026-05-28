export const ADVISOR_BRAND = {
  name: 'Anclora Advisor AI',
  description: 'Plataforma de asesoramiento fiscal, laboral y de mercado para autónomos — Anclora Group',
  family: 'Internal',
  role: 'internal-baseline',

  // Typography (Internal contract — do NOT change to DM Sans)
  displayFont: 'Cormorant Garamond',
  bodyFont: 'Source Sans 3',

  // Colors — placeholder palette until user delivers new assets
  primaryColor: '#162944',    // Navy — placeholder
  accentColor: '#1dab89',     // Mint green — placeholder
  accentDim: '#17987a',       // Mint dim — placeholder
  darkCanvas: '#1c2b3c',      // Dark canvas — placeholder
  lightCanvas: '#f3f6fb',     // Light canvas — placeholder

  // Assets
  logoPath: '/brand/logo-Advisor.png',
  faviconPath: '/brand/favicon.ico',
  faviconPng32: '/brand/advisor_favicon_32.png',
  faviconPng192: '/brand/advisor_favicon_192.png',
  faviconPng512: '/brand/advisor_favicon_512.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',

  // App preferences (Internal baseline contract)
  supportedThemes: ['dark', 'light', 'system'] as const,
  supportedLanguages: ['es', 'en'] as const,

  // Component system
  componentPrefix: 'advisor-',
  assetPrefix: 'advisor_',
} as const
