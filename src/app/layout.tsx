import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anclora Advisor AI',
  description: 'Asesor fiscal, laboral y mercado',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
