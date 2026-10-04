import Link from 'next/link';
import { requirePlatformOwner } from '@/lib/platform/requirePlatformOwner';
import { CopyInvitationLink } from '@/components/platform/CopyInvitationLink';
import { createClientOrganization } from './actions';

interface PlatformPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
    invitation?: string;
  }>;
}

interface OrganizationRecord {
  id: string;
  name: string;
  created_at: string;
}

const errorMessages: Record<string, string> = {
  missing_fields: 'Completa el nombre de la organizacion y el email del administrador.',
  invalid_fields: 'Revisa el nombre de la organizacion y el formato del email.',
  email_already_registered: 'Ese email ya pertenece a un usuario de Anulus AI.',
  invitation_already_exists: 'Ese email ya tiene una invitacion pendiente o aceptada.',
  create_failed: 'No se pudo crear la organizacion. Revisa la configuracion de Supabase.',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const params = await searchParams;
  const { owner, admin } = await requirePlatformOwner();

  const { data: organizations } = await admin
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(12);

  let invitationUrl: string | null = null;
  let invitedEmail: string | null = null;

  if (params.invitation) {
    const { data: invitation } = await admin
      .from('user_invitations')
      .select('id, email, invitation_token, status')
      .eq('id', params.invitation)
      .eq('status', 'pending')
      .maybeSingle();

    if (invitation?.invitation_token) {
      const appUrl =
        process.env.APP_URL?.trim() || 'https://centinela-ia-documentos.vercel.app';
      const url = new URL('/invitacion/aceptar', appUrl);
      url.searchParams.set('email', invitation.email);
      url.searchParams.set('token', invitation.invitation_token);
      invitationUrl = url.toString();
      invitedEmail = invitation.email;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-400">
              Anulus AI
            </p>
            <h1 className="mt-2 text-3xl font-black">Panel del dueno de plataforma</h1>
            <p className="mt-2 text-sm text-slate-300">Sesion autorizada: {owner.email}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-900"
            >
              Panel operativo
            </Link>
            <a
              href="/logout"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950"
            >
              Salir
            </a>
          </div>
        </header>

        {params.error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {errorMessages[params.error] ?? 'Ocurrio un error al procesar la operacion.'}
          </div>
        ) : null}

        {params.success === 'organization_created' && invitationUrl ? (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-bold text-emerald-800">Organizacion creada correctamente</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Invitacion administrativa lista
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              El enlace corresponde a {invitedEmail}. Tambien se intento enviar por correo.
            </p>
            <CopyInvitationLink invitationUrl={invitationUrl} />
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
              Nuevo cliente
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Crear organizacion aislada
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Se creara un espacio independiente y una invitacion con rol Administrador.
            </p>

            <form action={createClientOrganization} className="mt-6 space-y-5">
              <label className="block">
                <span className="text-sm font-bold text-slate-800">Nombre del cliente</span>
                <input
                  name="organization_name"
                  required
                  maxLength={160}
                  placeholder="Ej: Estudio Juridico Norte"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-800">
                  Email del primer Administrador
                </span>
                <input
                  name="admin_email"
                  type="email"
                  required
                  placeholder="administrador@cliente.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none focus:border-sky-500"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-2xl bg-sky-500 px-5 py-3 font-bold text-white hover:bg-sky-600"
              >
                Crear organizacion e invitacion
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Organizaciones
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Ultimos espacios creados
            </h2>
            <div className="mt-6 space-y-3">
              {((organizations ?? []) as OrganizationRecord[]).map((organization) => (
                <article
                  key={organization.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="font-bold text-slate-950">{organization.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Creada {formatDate(organization.created_at)} · {organization.id}
                  </p>
                </article>
              ))}
              {(organizations?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">
                  Todavia no hay organizaciones registradas.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
