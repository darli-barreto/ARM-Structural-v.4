import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Modelador Estructural BIM 3D',
  description:
    'Modelador estructural BIM 3D interactivo para diseño y cálculo de estructuras.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full w-full overflow-hidden overscroll-none">
      <body className="h-[100dvh] w-full overflow-hidden overflow-x-hidden overscroll-none bg-slate-900 font-sans text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
