import type { Metadata } from 'next';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Cómo funciona | Centinela IA',
  description:
    'Conocé el recorrido transversal de Centinela IA para organizaciones jurídicas, notariales e inmobiliarias: expedientes, documentos, radar de plazos, análisis con IA y auditoría.',
};

const whatsappUrl =
  'https://wa.me/543794733321?text=Hola,%20quiero%20coordinar%20una%20presentaci%C3%B3n%20de%20Centinela%20IA';

const demoSteps = [
  'Login seguro y multi-organización con control de roles',
  'Dashboard operativo adaptado por rubro (Legal, Notarial, Inmobiliario)',
  'Gestión documental integral: expedientes, legajos y operaciones',
  'Radar de plazos, audiencias judiciales y vigencias de certificados',
  'Herramientas inmobiliarias: inventario de propiedades y cartera de clientes',
  'Módulos específicos: Pre-Score crediticio y matching comercial',
  'Herramientas notariales: cálculo de sellos, tasas y derivación de escrituras',
  'Biblioteca de modelos documentales y borradores asistidos con IA',
  'Visor de documentos sensibles con enlaces seguros de lectura',
  'Auditoría inmutable de accesos y trazabilidad de eventos',
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">
      {children}
    </p>
  );
}

function SectionGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
    </div>
  );
}

export default function ComoFuncionaPage() {
  return (
    <main className="min-h-screen bg-[#0A1830] text-white">
      <SiteHeader />
      <BackHomeLink />
      <RevealSection className="premium-section-b relative flex min-h-screen items-center overflow-hidden px-6 py-16 md:py-24">
        <SectionGlow />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionLabel>Presentación guiada</SectionLabel>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Conocé el flujo completo en una presentación guiada.
              </h1>
              <p className="mt-5 text-base leading-8 text-[#C2CCD9]">
                Descubrí cómo Centinela IA adapta sus herramientas según la especialidad de tu organización:
                estudios jurídicos, escribanías e inmobiliarias cuentan con flujos documentales dedicados,
                radar de plazos y vencimientos, análisis con IA server-side y trazabilidad completa de cada acción.
              </p>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="premium-primary-button mt-7 inline-flex rounded-2xl bg-[#1E9BF0] px-6 py-3.5 text-sm font-black text-[#061426] shadow-[0_12px_32px_rgba(30,155,240,0.22)]"
              >
                Coordinar presentación
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {demoSteps.map((step, index) => (
                <div
                  key={step}
                  className="premium-card landing-card flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_16px_38px_rgba(0,0,0,0.18)] backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300/25 bg-sky-400/10 text-sm font-black text-sky-300 shadow-[0_0_18px_rgba(30,155,240,0.14)]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold text-slate-100">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
