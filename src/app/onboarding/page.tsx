import { createOrganization } from './actions';

interface OnboardingPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
          Configuración inicial
        </p>

        <h1 className="mt-3 text-3xl font-bold">Crear organización</h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Este paso crea el espacio privado de trabajo y asigna el primer usuario administrador.
        </p>

        {params.error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            No se pudo completar la configuración. Revisá los datos o intentá nuevamente.
          </div>
        ) : null}

        <form action={createOrganization} className="mt-8 grid gap-4">
          <div>
            <label className="text-sm font-semibold">Nombre de la organización</label>
            <input
              name="org_name"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Escribanía / Estudio / Inmobiliaria"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Rubro</label>
            <select
              name="industry"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="legal">Jurídico</option>
              <option value="escribania">Escribanía</option>
              <option value="inmobiliaria">Inmobiliaria</option>
            </select>
            <p className="mt-2 text-xs font-semibold text-rose-600">
              ⚠️ Elegí con cuidado: el rubro define tus herramientas y flujos y no se puede cambiar después.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Ciudad</label>
              <input
                name="city"
                defaultValue="Corrientes"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Provincia</label>
              <input
                name="province"
                defaultValue="Corrientes"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Nombre del administrador</label>
            <input
              name="admin_full_name"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Tobías Pérez"
            />
          </div>

          <button className="mt-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
            Crear organización
          </button>
        </form>
      </div>
    </main>
  );
}