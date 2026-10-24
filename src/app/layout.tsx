import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { brand } from '@/config/brand';
import './globals.css';

const ui = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.productionUrl),
  title: {
    default: `${brand.name} | ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description:
    'Plataforma web para centralizar expedientes, documentos PDF, usuarios, permisos y actividad auditada en un entorno privado.',
  applicationName: brand.name,
  keywords: [
    'gestión documental',
    'expedientes digitales',
    'documentos privados',
    'auditoría documental',
    'software para estudios jurídicos',
    'software para inmobiliarias',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/brand/anulus-mark.svg',
    apple: '/brand/anulus-mark.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    siteName: brand.name,
    title: `${brand.name} | ${brand.tagline}`,
    description:
      'Centralizá expedientes, documentos y accesos desde un panel privado con roles y actividad auditada.',
  },
  twitter: {
    card: 'summary',
    title: `${brand.name} | ${brand.tagline}`,
    description:
      'Centralizá expedientes, documentos y accesos desde un panel privado con roles y actividad auditada.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${ui.variable} ${display.variable}`}>
      <body className="font-ui">{children}</body>
    </html>
  );
}
