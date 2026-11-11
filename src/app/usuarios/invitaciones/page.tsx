import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { roleOptions, roleLabel, roleTone } from '@/lib/permissions/roleDisplay';
import { cancelUserInvitation, createUserInvitation } from '../actions';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

interface InvitationsPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

interface InvitationRecord {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  invited_by?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ProfileRecord {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
}


function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}


function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptada',
    cancelled: 'Cancelada',
    expired: 'Vencida',
  };

  return labels[status ?? ''] ?? status ?? 'Sin estado';
}

function statusTone(status?: string | null) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700';
  if (status === 'expired') return 'bg-slate-100 text-slate-600';

  return 'bg-slate-100 text-slate-600';
}

function expiryAvailability(value?: string | null): 'valid' | 'absent' {
  if (!value) return 'absent';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'absent' : 'valid';
}

function isExpired(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

function getMessage(params: { success?: string; error?: string }) {
  if (params.success === 'invitation_created') {
    return {
      type: 'success',
      text: 'Invitación operativa creada correctamente.',
    };
  }

  if (params.success === 'invitation_cancelled') {
    return {
      type: 'success',
      text: 'Invitación cancelada correctamente.',
    };
  }

  const errors: Record<string, string> = {
    missing_fields: 'Faltan datos para crear la invitación.',
    invalid_email: 'El email ingresado no tiene un formato válido.',
    invalid_role: 'El rol seleccionado no es válido.',
    admin_required: 'Solo un administrador puede gestionar invitaciones.',
    admin_role_platform_only:
      'Solo el dueño de plataforma puede crear Administradores.',
    user_already_exists: 'Ya existe un usuario con ese email en la organización.',
    invitation_already_pending: 'Ya existe una invitación pendiente para ese email.',
    invitation_already_accepted: 'Ya existe una invitación aceptada para ese email.',
    invitation_create_failed: 'No se pudo crear la invitación. Revisá RLS o estructura de tabla.',
    missing_invitation: 'No se recibió la invitación a cancelar.',
    invitation_not_found: 'No se encontró la invitación.',
    invitation_not_pending: 'Solo se pueden cancelar invitaciones pendientes.',
    cancel_failed: 'No se pudo cancelar la invitación.',
  };

  if (params.error) {
    return {
      type: 'error',
      text: errors[params.error] ?? 'Ocurrió un error al procesar la invitación.',
    };
  }

  return null;
}

export default async function UserInvitationsPage({
  searchParams,
}: InvitationsPageProps) {
  const params = await searchParams;
  const message = getMessage(params);

  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const [invitationsResult, profilesResult] = await Promise.all([
    supabase
      .from('user_invitations')
      .select(
        'id, organization_id, email, role, status, invited_by, accepted_by, accepted_at, cancelled_at, expires_at, created_at, updated_at'
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, full_name, email, role, status')
      .eq('organization_id', profile.organization_id)
      .order('email', { ascending: true }),
  ]);

  if (invitationsResult.error) {
    console.error('Invitations query error:', invitationsResult.error);
  }

  if (profilesResult.error) {
    console.error('Profiles query error:', profilesResult.error);
  }

  const invitations = (invitationsResult.data ?? []) as InvitationRecord[];
  const users = (profilesResult.data ?? []) as ProfileRecord[];

  // Un fallo de consulta no se presenta como vacío ni como cero.
  const invitationsUnavailable = Boolean(invitationsResult.error);
  const usersUnavailable = Boolean(profilesResult.error);

  const pendingInvitations = invitations.filter((item) => item.status === 'pending');
  const acceptedInvitations = invitations.filter((item) => item.status === 'accepted');
  const cancelledInvitations = invitations.filter((item) => item.status === 'cancelled');

  const expiredPendingInvitations = pendingInvitations.filter((item) =>
    isExpired(item.expires_at)
  );

  const canManage = profile.role === 'admin';

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            Usuarios
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-950">
            Invitaciones de usuarios
          </h2>

          <p className="mt-2 text-sm text-slate-600">
Gestión operativa de invitaciones, roles y accesos a la organización.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/usuarios"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Volver a usuarios
          </Link>

          <Link
            href="/reportes?vista=auditoria"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Ver auditoría
          </Link>
        </div>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Usuarios actuales</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{usersUnavailable ? '—' : users.length}</p>
          <p className="mt-3 text-xs text-slate-500">
            {usersUnavailable ? 'Consulta no disponible' : 'Perfiles activos en la organización'}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Invitaciones pendientes
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {invitationsUnavailable ? '—' : pendingInvitations.length}
          </p>
          <p className="mt-3 text-xs text-slate-500">Incluye pendientes vencidas</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Aceptadas</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {invitationsUnavailable ? '—' : acceptedInvitations.length}
          </p>
          <p className="mt-3 text-xs text-slate-500">Altas completadas</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Canceladas</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {invitationsUnavailable ? '—' : cancelledInvitations.length}
          </p>
          <p className="mt-3 text-xs text-slate-500">Invitaciones desestimadas</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.75fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            Nueva invitación
          </p>

          <h3 className="mt-2 text-2xl font-bold text-slate-950">
            Preparar acceso
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
Esta acción registra una invitación operativa para controlar el alta, rol y estado de acceso del usuario dentro de la organización.
          </p>

          {canManage ? (
            <form action={createUserInvitation} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Email del usuario
                </label>

                <input
                  name="email"
                  type="email"
                  required
                  placeholder="operador@empresa.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Rol inicial
                </label>

                <select
                  name="role"
                  defaultValue="employee"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <FormSubmitButton
                label="Registrar invitación"
                loadingLabel="Registrando…"
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Solo administradores pueden crear invitaciones.
            </div>
          )}

          <div className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm">
            <div className="mt-0.5 text-sky-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <div>
              <p className="font-bold text-white">Control operativo</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Las invitaciones permiten ordenar accesos, roles y trazabilidad durante la beta operativa. Registrar una invitación no acredita la entrega del correo ni su aceptación: esos pasos se verifican por separado.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
                Bandeja
              </p>

              <h3 className="mt-2 text-2xl font-bold text-slate-950">
                Invitaciones registradas
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Historial de invitaciones de acceso a la organización.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              {invitationsUnavailable ? '—' : `${invitations.length} registros`}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {invitationsUnavailable ? (
              <div className="p-6 text-sm text-amber-800">
                No se pudieron consultar las invitaciones. La bandeja no se presenta como vacía hasta confirmar el estado real de la consulta.
              </div>
            ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {invitations.map((invitation) => {
                  const expired =
                    invitation.status === 'pending' && isExpired(invitation.expires_at);
                  const expiryAvailable = expiryAvailability(invitation.expires_at) === 'valid';
                  const canCancel = canManage && invitation.status === 'pending' && !expired && expiryAvailable;

                  return (
                    <tr key={invitation.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-950">{invitation.email}</p>

                        <p className="mt-1 text-xs text-slate-500">
                          Creada: {formatDate(invitation.created_at)}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${roleTone(
                            invitation.role
                          )}`}
                        >
                          {roleLabel(invitation.role)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            expired
                              ? 'bg-slate-100 text-slate-600'
                              : statusTone(invitation.status)
                          }`}
                        >
                          {expired ? 'Vencida' : statusLabel(invitation.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {expiryAvailable ? formatDate(invitation.expires_at) : 'No disponible'}
                      </td>

                      <td className="px-4 py-4">
                        {canCancel ? (
                          <form action={cancelUserInvitation}>
                            <input
                              type="hidden"
                              name="invitation_id"
                              value={invitation.id}
                            />

                            <FormSubmitButton
                              label="Cancelar"
                              loadingLabel="Cancelando…"
                              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </form>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">
                            Sin acción
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            {invitations.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Todavía no hay invitaciones registradas.
              </div>
            ) : null}
            </table>
            )}
          </div>
        </section>
      </div>

      {expiredPendingInvitations.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-bold text-amber-950">
            Hay invitaciones pendientes vencidas.
          </p>

          <p className="mt-1">
            {canManage
              ? 'Podés cancelarlas desde la bandeja cuando el control de cancelación esté disponible.'
              : 'Su gestión corresponde a un administrador de la organización.'}
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}
