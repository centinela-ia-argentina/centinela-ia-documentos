import type { Metadata } from 'next';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Seguridad | Anulus AI',
  description:
    'Conocé los controles de confidencialidad, acceso, almacenamiento y auditoría de Anulus AI.',
};

const securityItems = [
  {
    title: 'Aislamiento por organización',
    description: 'Cada usuario accede únicamente a la información vinculada con su organización.',
  },
  {
    title: 'Almacenamiento privado',
    description:
      'Los documentos se guardan en un espacio privado y se consultan mediante enlaces temporales.',
  },
  {
    title: 'Roles y permisos',
    description: 'Las funciones sensibles se habilitan según el perfil asignado a cada usuario.',
  },
  {
    title: 'Actividad auditada',
    description:
      'Las acciones relevantes quedan registradas para facilitar la trazabilidad operativa.',
  },
  {
    title: 'Rutas protegidas',
    description: 'El sistema valida sesión, estado y permisos antes de abrir áreas restringidas.',
  },
  {
    title: 'Separación desde la base de datos',
    description:
      'Las políticas de acceso refuerzan la separación de registros entre organizaciones.',
  },
];

export default function SeguridadPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#020d29,_#082746)] text-white">
      <SiteHeader />
      <BackHomeLink />
      <RevealSection className="flex min-h-screen items-center px-6 py-16 md:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">
                Confidencialidad y seguridad
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Controles activos para proteger información sensible.
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Anulus AI combina autenticación, aislamiento por organización,
                almacenamiento privado, permisos por rol y auditoría para reducir accesos
                indebidos y mejorar el control interno. Incorpora criterios de confidencialidad
                y control de acceso orientados a buenas prácticas de protección de datos
                personales.
              </p>

              <div className="mt-7 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Controles operativos en la beta actual
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {securityItems.map((item) => (
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
