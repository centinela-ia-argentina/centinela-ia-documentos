import type { Metadata } from 'next';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Análisis documental | Anulus AI',
  description:
    'Conocé las funciones de clasificación, sensibilidad y revisión documental asistida de Anulus AI.',
};

const aiItems = [
  'Clasificación inicial de documentos',
  'Detección de sensibilidad',
  'Resumen operativo',
  'Alertas documentales',
  'Historial de análisis',
  'Base preparada para futuras integraciones',
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">
      {children}
    </p>
  );
}

export default function AnalisisDocumentalPage() {
  return (
    <main className="min-h-screen bg-[#0A1830] text-white">
      <SiteHeader />
      <BackHomeLink />
      <RevealSection className="premium-section-a relative flex min-h-screen items-center overflow-hidden px-6 py-16 md:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>IA documental</SectionLabel>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Análisis documental en entorno beta controlado.
              </h1>
              <p className="mt-5 text-base leading-8 text-[#C2CCD9]">
                La plataforma permite preparar lecturas documentales, detectar sensibilidad,
                generar revisiones iniciales y ordenar información clave dentro de un flujo
                controlado.
              </p>
              <p className="mt-4 text-base leading-8 text-[#C2CCD9]">
                Durante el acceso beta, el objetivo es validar la utilidad real del análisis
                documental, la experiencia de uso y la trazabilidad antes de integrar
                proveedores externos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {aiItems.map((item) => (
                <div
                  key={item}
                  className="premium-card landing-card rounded-2xl border border-white/10 bg-white/[0.055] p-5 text-sm font-bold text-slate-100 shadow-[0_16px_38px_rgba(0,0,0,0.18)] backdrop-blur-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
