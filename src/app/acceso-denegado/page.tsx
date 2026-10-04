import Link from 'next/link';

interface AccessDeniedPageProps {
  searchParams: Promise<{
    motivo?: string;
  }>;
}

export default async function AccessDeniedPage({
  searchParams,
}: AccessDeniedPageProps) {
  const params = await searchParams;

  const isInactiveStatus = params.motivo === 'estado';
  const isRoleDenied = params.motivo === 'rol';

  const title = isInactiveStatus
    ? 'Usuario sin acceso activo'
    : isRoleDenied
      ? 'Permiso insuficiente'
      : 'Acceso denegado';

  const description = isInactiveStatus
    ? 'Tu usuario existe, pero no se encuentra activo para operar dentro del sistema. Contactá a un administrador para revisar el estado de acceso.'
    : isRoleDenied
      ? 'Tu rol actual no tiene permisos para ingresar a este módulo. Podés volver al panel principal o cerrar sesión manualmente.'
      : 'No tenés permisos suficientes para acceder a esta sección del sistema.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
          Anulus AI Documentos
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {description}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">
            Control de Beta operativa comercial
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta protección evita que usuarios inactivos o roles no administrativos
            puedan ingresar a áreas sensibles como usuarios, invitaciones o auditoría.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Volver al panel
          </Link>

          <a
            href="/logout"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cerrar sesión
          </a>
        </div>
      </section>
    </main>
  );
}