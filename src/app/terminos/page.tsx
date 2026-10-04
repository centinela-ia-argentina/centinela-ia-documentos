import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de uso',
  description: 'Condiciones generales de uso de Anulus AI en su etapa beta.',
};

const sections = [
  {
    title: 'Alcance de la beta',
    content:
      'Anulus AI se encuentra en una etapa beta operativa. Las funciones, límites y condiciones comerciales se acuerdan con cada organización antes de habilitar el acceso.',
  },
  {
    title: 'Usuarios autorizados',
    content:
      'El acceso es personal y está reservado a usuarios autorizados. Cada persona debe proteger sus credenciales y utilizar únicamente las funciones permitidas por su rol y organización.',
  },
  {
    title: 'Uso responsable',
    content:
      'No está permitido intentar acceder a información ajena, vulnerar controles, interferir con el servicio o cargar contenido ilícito. La organización usuaria es responsable de contar con autorización para gestionar los documentos que incorpora.',
  },
  {
    title: 'Análisis documental',
    content:
      'Las funciones de análisis ofrecen asistencia operativa inicial. Sus resultados no reemplazan revisión profesional, asesoramiento jurídico ni decisiones humanas sobre documentación sensible.',
  },
  {
    title: 'Disponibilidad y cambios',
    content:
      'Durante la beta pueden realizarse mejoras, mantenimientos o cambios de funcionalidad. Los incidentes relevantes y condiciones específicas de soporte se gestionan con cada organización participante.',
  },
  {
    title: 'Contacto',
    content:
      'Las consultas sobre estos términos pueden enviarse a tobiasexequielperez11@gmail.com.',
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f8fb] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold text-sky-700 hover:text-sky-800">
          Volver a Anulus AI
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Información legal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Términos de uso</h1>
        <p className="mt-4 text-sm text-slate-500">Última actualización: 19 de junio de 2026.</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black">{section.title}</h2>
              <p className="mt-3 leading-7 text-slate-600">{section.content}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
          Estas condiciones resumen el alcance actual de la beta. Los acuerdos comerciales específicos pueden establecer condiciones adicionales.
        </p>
      </div>
    </main>
  );
}
