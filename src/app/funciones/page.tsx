import type { Metadata } from 'next';
import { BackHomeLink } from '@/components/BackHomeLink';
import { RevealSection } from '@/components/landing-reveal-section';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Funciones | Anulus AI',
  description:
    'Conocé las funciones y los resultados operativos de la plataforma documental Anulus AI.',
};

const features = [
  {
    title: 'Dashboard operativo',
    description: 'Métricas generales de expedientes, documentos, análisis y actividad.',
  },
  {
    title: 'Expedientes',
    description: 'Carpetas de trabajo para organizar casos, operaciones o trámites.',
  },
  {
    title: 'Bóveda documental',
    description: 'Carga y consulta de documentos PDF en un entorno privado.',
  },
  {
    title: 'Visor PDF',
    description: 'Visualización de archivos mediante enlaces temporales seguros.',
  },
  {
    title: 'Análisis documental',
    description: 'Lectura asistida para clasificación, sensibilidad y revisión inicial.',
  },
  {
    title: 'Reportes',
    description: 'Vistas operativas para documentos, invitaciones, actividad y auditoría.',
  },
  {
    title: 'Usuarios y roles',
    description: 'Control de accesos según perfil y organización.',
  },
  {
    title: 'Auditoría',
    description: 'Registro de acciones relevantes dentro del sistema.',
  },
];

const commercialOutcomes = [
  {
    title: 'Menos dispersión documental',
    description:
      'Encontrá expedientes y documentos desde una estructura centralizada, sin depender de carpetas, emails o WhatsApp.',
  },
  {
    title: 'Mayor trazabilidad',
    description:
      'Consultá la actividad auditada para identificar acciones relevantes realizadas sobre documentos.',
  },
  {
    title: 'Control centralizado',
    description: 'Usuarios, permisos, documentos y reportes administrados desde un solo lugar.',
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">
      {children}
    </p>
  );
}

function SectionTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <SectionLabel>{label}</SectionLabel>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-7 text-[#C2CCD9] md:text-lg">{description}</p>
    </div>
  );
}

export default function FuncionesPage() {
  return (
    <main className="min-h-screen bg-[#0A1830] text-white">
      <SiteHeader />
      <BackHomeLink />

      <RevealSection className="premium-section-a relative overflow-hidden px-6 pb-24 pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            label="Módulos"
            title="Todo lo que tu equipo necesita para gestionar documentación sensible."
            description="Anulus AI reúne las herramientas principales para organizar expedientes, cargar documentos, visualizar PDFs, controlar usuarios y revisar actividad desde un entorno privado."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="premium-card landing-card rounded-2xl border border-white/10 bg-white/[0.055] p-7 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur-sm"
              >
                <h2 className="text-base font-black text-white">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#C2CCD9]">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="premium-card mt-8 rounded-2xl border border-sky-300/15 bg-gradient-to-br from-[#0C2340] to-[#071326] p-6 text-white shadow-[0_22px_55px_rgba(0,0,0,0.25)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
              Resultados operativos
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {commercialOutcomes.map((outcome) => (
                <div
                  key={outcome.title}
                  className="premium-card rounded-2xl border border-white/10 bg-white/[0.055] p-5"
                >
                  <h2 className="text-base font-black">{outcome.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {outcome.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
