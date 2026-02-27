import type { Metadata } from 'next';
import type { ReactNode } from "react";
import './globals.css';

export const metadata: Metadata = {
  title: 'Anclora Advisor AI · Anclora Group',
  description: 'Plataforma de asesoramiento fiscal, laboral y de mercado para autónomos — Anclora Group',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
