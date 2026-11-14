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

/* Íconos de trazo fino (Phosphor) */
function PersonIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 12h12" strokeLinecap="round" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ClockIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EnvelopeIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Pills simétricas: ancho y alto fijos, contenido centrado */
function RolePill({ role }: { role?: string | null }) {
  const base =
    'inline-flex h-7 w-[126px] items-center justify-center gap-1.5 rounded-full text-[12px] font-bold';

  if (role === 'employee') {
    return (
      <span className={`${base} border border-[#d9e2f5] bg-[#eef2fb] text-[#2b4a9e]`}>
        <BriefcaseIcon /> Operador
      </span>
    );
  }

  if (role === 'auditor') {
    return (
      <span className={`${base} border border-[#e5dcf5] bg-[#f4f0fb] text-[#5b3a9e]`}>
        <CheckCircleIcon className="h-3.5 w-3.5" /> Auditor
      </span>
    );
  }

  if (role === 'client') {
    return (
      <span className={`${base} border border-[#f0e5cc] bg-[#fbf4e8] text-[#8a6414]`}>
        <PersonIcon className="h-3.5 w-3.5" /> Cliente
      </span>
    );
  }

  return (
    <span className={`${base} border border-neutral-200 bg-neutral-100 text-neutral-600`}>
      <MinusIcon /> Sin definir
    </span>
  );
}

function StatusPill({ status, expired }: { status?: string | null; expired?: boolean }) {
  const base =
    'inline-flex h-7 w-[126px] items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold';

  if (expired) {
    return (
      <span className={`${base} border border-neutral-200 bg-neutral-100 text-neutral-600`}>
        <MinusIcon /> Vencida
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className={`${base} border border-[#f0e5cc] bg-[#fbf4e8] text-[#8a6414]`}>
        <ClockIcon /> Pendiente
      </span>
    );
  }

  if (status === 'accepted') {
    return (
      <span className={`${base} border border-[#d5f0de] bg-[#eefaf1] text-[#1f7a3d]`}>
        <CheckIcon /> Aceptada
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className={`${base} border border-[#f5d5d5] bg-[#fdecec] text-[#a13a3a]`}>
        <XIcon /> Cancelada
      </span>
    );
  }

  if (status === 'expired') {
    return (
      <span className={`${base} border border-neutral-200 bg-neutral-100 text-neutral-600`}>
        <MinusIcon /> Vencida
      </span>
    );
  }

  return (
    <span className={`${base} border border-neutral-200 bg-neutral-100 text-neutral-600`}>
      <MinusIcon /> {statusLabel(status)}
    </span>
  );
}

function EnvelopeAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-[#fafafa] text-neutral-600">
      <EnvelopeIcon />
    </div>
  );
}

/* Botón de acción simétrico: ancho fijo 112px, alto fijo 32px */
const ACTION_BTN =
  'inline-flex h-8 w-[112px] items-center justify-center rounded-lg text-[12px] font-bold transition-colors';

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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            Gestión de accesos
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            Invitaciones de usuarios
          </h2>

          <p className="mt-2 text-[13px] text-neutral-500">
            Gestión operativa de invitaciones, roles y accesos a la organización.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/reportes?vista=auditoria"
            className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900 transition-colors hover:border-neutral-400"
          >
            Ver auditoría
          </Link>
        </div>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-xl border px-5 py-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MotionCardShell
          label={
            <>
              <PersonIcon /> Usuarios actuales
            </>
          }
        >
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {usersUnavailable ? '—' : users.length}
          </p>
          <p className="mt-1 text-[11.5px] text-neutral-400">
            {usersUnavailable ? 'Consulta no disponible' : 'Perfiles activos en la organización'}
          </p>
        </MotionCardShell>

        <MotionCardShell
          label={
            <>
              <BellIcon /> Invitaciones pendientes
            </>
          }
        >
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {invitationsUnavailable ? '—' : pendingInvitations.length}
          </p>
          <p className="mt-1 text-[11.5px] text-neutral-400">Incluye pendientes vencidas</p>
        </MotionCardShell>

        <MotionCardShell
          label={
            <>
              <CheckIcon className="h-3.5 w-3.5" /> Aceptadas
            </>
          }
        >
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {invitationsUnavailable ? '—' : acceptedInvitations.length}
          </p>
          <p className="mt-1 text-[11.5px] text-neutral-400">Altas completadas</p>
        </MotionCardShell>

        <MotionCardShell
          label={
            <>
              <XIcon /> Canceladas
            </>
          }
        >
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {invitationsUnavailable ? '—' : cancelledInvitations.length}
          </p>
          <p className="mt-1 text-[11.5px] text-neutral-400">Invitaciones desestimadas</p>
        </MotionCardShell>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            Nueva invitación
          </p>

          <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
            Preparar acceso
          </h3>

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">
            Registra una invitación operativa para controlar el alta, rol y estado de acceso del usuario dentro de la organización.
          </p>

          {canManage ? (
            <form action={createUserInvitation} className="mt-5">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-neutral-900">
                  Email del usuario
                </label>

                <input
                  name="email"
                  type="email"
                  required
                  placeholder="operador@empresa.com"
                  className="w-full rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mt-3.5">
                <label className="mb-1.5 block text-[12px] font-bold text-neutral-900">
                  Rol inicial
                </label>

                <select
                  name="role"
                  defaultValue="employee"
                  className="w-full rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-neutral-900 outline-none focus:border-neutral-500"
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
                className="mt-5 w-full rounded-lg bg-neutral-900 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-neutral-700 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </form>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm font-semibold text-amber-800">
              Solo administradores pueden crear invitaciones.
            </div>
          )}

          <p className="mt-4 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-[11.5px] leading-relaxed text-neutral-500">
            Registrar una invitación no acredita la entrega del correo ni su aceptación: se verifican por separado.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Bandeja
              </p>

              <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
                Invitaciones registradas
              </h3>

              <p className="mt-1 text-[12.5px] text-neutral-500">
                Historial de invitaciones de acceso a la organización.
              </p>
            </div>

            <span className="text-[12px] font-semibold text-neutral-400">
              {invitationsUnavailable ? '—' : `${invitations.length} ${invitations.length === 1 ? 'registro' : 'registros'}`}
            </span>
          </div>

          {expiredPendingInvitations.length > 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-[11.5px] text-neutral-500">
              <ClockIcon className="h-3 w-3 shrink-0 text-[#8a6414]" />
              <span>
                <b className="text-neutral-900">{expiredPendingInvitations.length} pendientes vencidas.</b>{' '}
                {canManage
                  ? 'Cancelalas desde la bandeja.'
                  : 'Su gestión corresponde a un administrador de la organización.'}
              </span>
            </p>
          ) : null}

          {invitationsUnavailable ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              No se pudieron consultar las invitaciones. La bandeja no se presenta como vacía hasta confirmar el estado real de la consulta.
            </div>
          ) : (
            <table className="mt-4 w-full text-left text-[13px]">
              <thead>
                <tr className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                  <th className="px-2 py-2.5">Email</th>
                  <th className="px-2 py-2.5 text-center">Rol</th>
                  <th className="px-2 py-2.5 text-center">Estado</th>
                  <th className="px-2 py-2.5">Vencimiento</th>
                  <th className="px-2 py-2.5 text-right">Acción</th>
                </tr>
              </thead>

              <tbody>
                {invitations.map((invitation) => {
                  const expired =
                    invitation.status === 'pending' && isExpired(invitation.expires_at);
                  const expiryAvailable = expiryAvailability(invitation.expires_at) === 'valid';
                  const canCancel = canManage && invitation.status === 'pending' && !expired && expiryAvailable;

                  return (
                    <tr key={invitation.id} className="border-t border-neutral-100 align-top">
                      <td className="px-2 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <EnvelopeAvatar />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-neutral-900" title={invitation.email}>
                              {invitation.email}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-neutral-400">
                              Creada: {formatDate(invitation.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-3.5 text-center">
                        <RolePill role={invitation.role} />
                      </td>

                      <td className="px-2 py-3.5 text-center">
                        <StatusPill status={invitation.status} expired={expired} />
                      </td>

                      <td className={`px-2 py-3.5 ${expiryAvailable ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {expiryAvailable ? formatDate(invitation.expires_at) : 'No disponible'}
                      </td>

                      <td className="px-2 py-3.5 text-right">
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
                              className={`${ACTION_BTN} border border-rose-200 bg-white text-rose-700 hover:border-rose-400 disabled:opacity-60 disabled:cursor-not-allowed`}
                            />
                          </form>
                        ) : (
                          <span className={`${ACTION_BTN} cursor-default border border-neutral-200 bg-white text-neutral-500`}>
                            Sin acción
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {invitations.length === 0 && !invitationsUnavailable ? (
            <div className="py-6 text-sm text-neutral-500">
              Todavía no hay invitaciones registradas.
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

/* Card de métrica estilo Panel inmobiliario: ícono + label, número, helper */
function MotionCardShell({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-500">
        {label}
      </div>
      {children}
    </div>
  );
}
