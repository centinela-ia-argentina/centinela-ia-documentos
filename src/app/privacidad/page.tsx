import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Información sobre el tratamiento de datos personales en Anulus AI.',
};

const sections = [
  {
    title: 'Datos que podemos recibir',
    content:
      'Cuando una persona realiza una consulta puede proporcionar nombre, organización, email y rubro. Los usuarios autorizados de la plataforma también cuentan con datos de perfil, acceso y actividad necesarios para operar el servicio.',
  },
  {
    title: 'Finalidad',
    content:
      'Los datos se utilizan para responder consultas comerciales, coordinar presentaciones, gestionar accesos autorizados, brindar soporte y mantener la seguridad y trazabilidad del sistema.',
  },
  {
    title: 'Formulario comercial',
    content:
      'La landing no almacena el formulario de contacto. Al enviarlo se abre WhatsApp con un mensaje preparado por el visitante. El envío queda sujeto también a las condiciones y políticas de WhatsApp.',
  },
  {
    title: 'Acceso y confidencialidad',
    content:
      'Anulus AI aplica controles por organización y rol. El acceso a información operativa está limitado a usuarios autorizados según las funciones habilitadas en la beta actual.',
  },
  {
    title: 'Conservación y derechos',
    content:
      'Las personas pueden solicitar información, actualización o eliminación de sus datos de contacto escribiendo a tobiasexequielperez11@gmail.com. Cada solicitud será evaluada según el contexto operativo y las obligaciones aplicables.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f8fb] px-6 py-12 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold text-sky-700 hover:text-sky-800">
          Volver a Anulus AI
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Información legal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Política de privacidad</h1>
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
          Este texto describe el funcionamiento actual de la beta y deberá revisarse si cambian los canales de contacto, proveedores o tratamientos de datos.
        </p>
      </div>
    </main>
  );
}
