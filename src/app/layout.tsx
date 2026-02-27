import type { Metadata } from 'next';
import type { ReactNode } from "react";
import './globals.css';

export const metadata: Metadata = {
  title: 'Anclora Advisor AI',
  description: 'Asesor fiscal, laboral y mercado',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
