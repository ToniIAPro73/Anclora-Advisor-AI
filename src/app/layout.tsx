import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import type { Metadata } from 'next';
import type { ReactNode } from "react";
import { AppPreferencesProvider } from "@/components/providers/AppPreferencesProvider";
import { AppPreferencesScript } from "@/components/providers/AppPreferencesScript";
import { CookieConsent } from "@/components/legal/CookieConsent";
import { ADVISOR_BRAND } from "@/lib/advisor-brand";
import './globals.css';

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-advisor-display",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-advisor-body",
});

export const metadata: Metadata = {
  title: ADVISOR_BRAND.name,
  description: ADVISOR_BRAND.description,
  icons: {
    icon: [
      { url: ADVISOR_BRAND.faviconPath, sizes: 'any' },
      { url: ADVISOR_BRAND.faviconPng32, type: 'image/png', sizes: '32x32' },
      { url: ADVISOR_BRAND.faviconPng192, type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: ADVISOR_BRAND.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
    shortcut: [ADVISOR_BRAND.faviconPath],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <AppPreferencesScript />
        <AppPreferencesProvider>
          {children}
          <CookieConsent />
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
