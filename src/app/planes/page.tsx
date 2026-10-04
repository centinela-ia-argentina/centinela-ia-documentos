import type { Metadata } from 'next';
import Link from 'next/link';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Planes y acceso beta | Anulus AI',
  description:
    'Conocé las condiciones iniciales, el acompañamiento y las opciones de acceso beta de Anulus AI.',
};

const plans = [
  {
    title: 'Beta Inicial',
    subtitle: 'Para equipos chicos que quieren probar la plataforma.',
    items: ['Setup inicial', 'Usuarios y roles', 'Acceso beta a la plataforma'],
    button: 'Consultar',
  },
  {
    title: 'Beta + Acompañamiento',
    subtitle: 'Para estudios e inmobiliarias que arrancan en serio.',
    items: [
      'Todo lo de Beta Inicial',
      'Configuración de organización',
      'Acompañamiento durante la beta',
      'Ajustes según feedback',
    ],
    button: 'Coordinar presentación',
    recommended: true,
  },
  {
    title: 'A Medida',
    subtitle: 'Para organizaciones con necesidades propias.',
    items: [
      'Todo lo de Beta + Acompañamiento',
      'Desarrollo a medida según requerimientos',
      'Preparado para integraciones futuras',
    ],
    button: 'Consultar a medida',
  },
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

export default function PlanesPage() {
  return (
    <main className="min-h-screen bg-[#0A1830] text-white">
      <SiteHeader />
      <BackHomeLink />
      <RevealSection className="premium-section-a relative flex min-h-screen items-center overflow-hidden px-6 py-16 md:py-24">
        <SectionGlow />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 shadow-[0_24px_65px_rgba(0,0,0,0.22)] backdrop-blur-sm md:p-10">
            <div>
              <SectionLabel>Acceso beta</SectionLabel>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Acceso inicial para primeros clientes.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-[#C2CCD9]">
                Anulus AI se ofrece inicialmente bajo modalidad de acceso beta, con cupos
                limitados para organizaciones que quieran validar el sistema en un entorno
                controlado.
              </p>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
                También se puede presupuestar una versión personalizada según los
                requerimientos de cada cliente. Cupos limitados y acompañamiento básico
                incluido durante la etapa beta.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.title}
                  className={`premium-card landing-card relative flex h-full flex-col rounded-2xl border p-7 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur-sm ${
                    plan.recommended
                      ? 'border-sky-400/70 bg-sky-400/[0.09] ring-1 ring-sky-300/30 shadow-[0_22px_60px_rgba(30,155,240,0.16)]'
                      : 'border-white/10 bg-white/[0.055]'
                  }`}
                >
                  {plan.recommended ? (
                    <span className="mb-4 inline-flex w-fit rounded-full border border-sky-300/25 bg-sky-400/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-200">
                      Recomendado
                    </span>
                  ) : null}

                  <h2 className="text-2xl font-black text-white">{plan.title}</h2>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-[#C2CCD9]">
                    {plan.subtitle}
                  </p>
                  <p className="mt-6 text-2xl font-black text-white">A consultar</p>

                  <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-sky-300">
                    Incluye
                  </p>
                  <ul className="mt-4 flex-1 space-y-3 pl-5 text-sm leading-6 text-slate-300">
                    {plan.items.map((item) => (
                      <li key={item} className="list-disc marker:text-sky-500">
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/#contacto"
                    className="premium-primary-button mt-8 inline-flex justify-center rounded-2xl bg-[#1E9BF0] px-5 py-3 text-center text-sm font-black text-[#061426] shadow-[0_12px_32px_rgba(30,155,240,0.22)]"
                  >
                    {plan.button}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
