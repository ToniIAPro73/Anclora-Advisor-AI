import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import type { Metadata } from 'next';
import type { ReactNode } from "react";
import { AppPreferencesProvider } from "@/components/providers/AppPreferencesProvider";
import { AppPreferencesScript } from "@/components/providers/AppPreferencesScript";
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
  title: 'Anclora Advisor AI · Anclora Group',
  description: 'Plataforma de asesoramiento fiscal, laboral y de mercado para autónomos — Anclora Group',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <AppPreferencesScript />
        <AppPreferencesProvider>{children}</AppPreferencesProvider>
      </body>
    </html>
  );
}
