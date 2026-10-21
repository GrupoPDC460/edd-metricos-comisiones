import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../estilos/app.css';

export const metadata: Metadata = {
  title: 'EDD, métricos y comisiones · Grupo PDC',
  description: 'Evaluaciones de desempeño, métricos y comisiones del equipo de Cobros Venta Directa — Grupo PDC.',
  robots: { index: false, follow: false },
  icons: { icon: '/assets/sonrisa-naranja.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,700;1,700&family=Nunito:wght@700;800;900&family=Nunito+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
