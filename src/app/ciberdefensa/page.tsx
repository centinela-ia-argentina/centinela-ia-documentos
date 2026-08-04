import type { Metadata } from 'next';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centinela Disuar | Centinela IA',
  description:
    'Ciberdefensa asistida por inteligencia artificial para organizaciones que no cuentan con un equipo de seguridad propio.',
};

const capacidades = [
  {
    title: 'Vigilancia continua',
    description:
      'La superficie expuesta de la organizacion se revisa de forma permanente, sin depender de que alguien se acuerde de hacerlo.',
  },
  {
    title: 'Intervencion temprana',
    description:
      'El objetivo es actuar mientras el intento todavia es preparacion, no cuando ya es consecuencia.',
  },
  {
    title: 'Respuesta reversible',
    description:
      'Lo unico que la plataforma decide sola es aquello que puede deshacerse sin perdida. Todo lo demas espera autorizacion humana.',
  },
  {
    title: 'Registro encadenado',
    description:
      'Cada accion queda asentada en un registro firmado y encadenado, donde una alteracion posterior resulta detectable.',
  },
  {
    title: 'Autorizacion explicita',
    description:
      'Ninguna medida de impacto irreversible se ejecuta sin que una persona responsable la apruebe.',
  },
  {
    title: 'Aprendizaje del incidente',
    description:
      'Despues de cada episodio se reconstruye que ocurrio y se ajustan las defensas para que no vuelva a repetirse igual.',
  },
];

export default function CiberdefensaPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#020d29,#082746)] text-white">
      <SiteHeader />
      <BackHomeLink />
      <RevealSection className="flex min-h-screen items-center px-6 py-16 md:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">
                Ciberdefensa asistida
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Centinela Disuar
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-300">
                La mayoria de las organizaciones no sufre un ataque sofisticado:
                sufre uno comun que nadie estaba mirando. Centinela Disuar vigila
                de forma continua aquello que queda expuesto, avisa temprano y
                deja registrado cada paso, para organizaciones que no tienen un
                equipo de seguridad propio.
              </p>
              <p className="mt-4 text-base leading-8 text-slate-300">
                La inteligencia artificial es el nucleo, no un accesorio: observa,
                correlaciona y propone. Pero su poder tiene un limite escrito. Solo
                actua por si misma cuando la medida es reversible; si algo no se
                puede deshacer, se detiene y pide autorizacion.
              </p>
              <div className="mt-7 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Modulo en desarrollo, no operativo en la beta actual
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {capacidades.map((item) => (
                <div
                  key={item.title}
                  className="landing-panel-item rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <h2 className="text-sm font-black text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
