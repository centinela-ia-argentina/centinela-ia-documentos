import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { formatAuditActionLabel } from '@/lib/audit/actionLabels';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { roleOptions, roleLabel, roleDescription, roleTone } from '@/lib/permissions/roleDisplay';
import { updateUserAccess } from './actions';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';

interface UsuariosPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

interface ProfileRecord {
  id: string;
  organization_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AuditLogRecord {
  id: string;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}



const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'invited', label: 'Invitado' },
  { value: 'inactive', label: 'Inactivo' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Sin registro';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin registro';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || 'Usuario';

  const parts = source
    .replace('@', ' ')
    .replace('.', ' ')
    .split(' ')
    .filter(Boolean);

  const first = parts[0]?.[0] ?? 'U';
  const second = parts[1]?.[0] ?? '';

  return `${first}${second}`.toUpperCase();
}


function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    invited: 'Invitado',
  };

  return labels[status ?? ''] ?? status ?? 'Sin estado';
}

function statusTone(status?: string | null) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'inactive') return 'bg-rose-50 text-rose-700';
  if (status === 'invited') return 'bg-amber-50 text-amber-700';

  return 'bg-slate-100 text-slate-600';
}

function countUserEvents(userId: string, auditLogs: AuditLogRecord[]) {
  return auditLogs.filter((item) => item.user_id === userId).length;
}

function getLastUserEvent(userId: string, auditLogs: AuditLogRecord[]) {
  return auditLogs.find((item) => item.user_id === userId) ?? null;
}

function getUsersByRole(users: ProfileRecord[], role: string) {
  return users.filter((item) => item.role === role).length;
}


function getMessage(params: { success?: string; error?: string }) {
  if (params.success === 'access_updated') {
    return {
      type: 'success',
      text: 'Acceso de usuario actualizado correctamente.',
    };
  }

  const errors: Record<string, string> = {
    missing_fields: 'Faltan datos para actualizar el acceso.',
    invalid_role: 'El rol seleccionado no es válido.',
    invalid_status: 'El estado seleccionado no es válido.',
    admin_required: 'Solo un administrador puede modificar accesos.',
    admin_role_platform_only:
      'Solo el dueño de plataforma puede crear o asignar Administradores.',
    user_not_found: 'No se encontró el usuario dentro de la organización.',
    self_change_blocked:
      'Por seguridad, no podés modificar tu propio rol o estado desde este panel.',
    update_failed:
      'No se pudo actualizar el acceso. Revisá políticas RLS o restricciones de la tabla profiles.',
  };

  if (params.error) {
    return {
      type: 'error',
      text: errors[params.error] ?? 'Ocurrió un error al procesar la acción.',
    };
  }

  return null;
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const params = await searchParams;
  const message = getMessage(params);

  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  if (profile.role !== "admin") {
  redirect("/acceso-denegado");
}

  const supabase = await createClient();

  const [profilesResult, auditLogsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, organization_id, full_name, email, role, status, last_login_at, created_at, updated_at'
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true }),

    supabase
      .from('audit_logs')
      .select('id, user_id, action, resource_type, resource_id, metadata, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const users = (profilesResult.data ?? []) as ProfileRecord[];
  const auditLogs = (auditLogsResult.data ?? []) as AuditLogRecord[];

  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === user.id) return -1;
    if (b.id === user.id) return 1;

    return String(a.full_name ?? a.email ?? '').localeCompare(
      String(b.full_name ?? b.email ?? '')
    );
  }); 

  const activeUsers = users.filter((item) => item.status === 'active').length;
  const invitedUsers = users.filter((item) => item.status === 'invited').length;
  const inactiveUsers = users.filter((item) => item.status === 'inactive').length;

  const adminUsers = getUsersByRole(users, 'admin');
  const employeeUsers = getUsersByRole(users, 'employee');
  const auditorUsers = getUsersByRole(users, 'auditor');
  const clientUsers = getUsersByRole(users, 'client');

  const canManageAccess = profile.role === 'admin';


  const metrics = [
    {
      label: 'Usuarios totales',
      value: users.length,
      helper: 'Perfiles de la organización',
    },
    {
      label: 'Usuarios activos',
      value: activeUsers,
      helper: 'Con acceso habilitado',
    },
    {
      label: 'Invitados',
      value: invitedUsers,
      helper: 'Perfiles marcados como invitados',
    },
    {
      label: 'Inactivos',
      value: inactiveUsers,
      helper: 'Acceso deshabilitado',
    },
  ];


  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Usuarios
          </p>

          <h2
            data-testid="users-page-title"
            className="mt-2 text-3xl font-bold text-white"
          >
            Control de usuarios y accesos
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/usuarios/invitaciones"
            className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.03] hover:bg-cyan-500 hover:shadow-cyan-500/40 active:scale-[0.97]"
          >
            Gestionar invitaciones
          </Link>

          <Link
            href="/reportes?vista=auditoria"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-200 transition-all hover:scale-[1.03] hover:border-cyan-400/40 hover:text-cyan-200 active:scale-[0.97]"
          >
            Ver auditoría
          </Link>

          <Link
            href="/documentos"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-200 transition-all hover:scale-[1.03] hover:border-cyan-400/40 hover:text-cyan-200 active:scale-[0.97]"
          >
            Ir a la Bóveda
          </Link>
        </div>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/25 bg-rose-400/10 text-rose-200'
          }`}
        >
          {message.text}
        </div>
      ) : null}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, idx) => (
          <MotionCard
            key={metric.label}
            index={idx}
            className="p-5"
          >
            <p className="text-sm font-semibold text-slate-300">{metric.label}</p>

            <p className="mt-2 text-3xl font-bold text-white">{metric.value}</p>

            <p className="mt-3 text-xs text-slate-400">{metric.helper}</p>
          </MotionCard>
        ))}
      </div>


      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <MotionCard index={4} className="min-w-0 p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Directorio
              </p>

              <h3 className="mt-2 text-2xl font-bold text-white">
                Usuarios de la organización
              </h3>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200">
              {users.length} perfiles
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.05] text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Estado / Rol</th>
                  <th className="px-4 py-3">Actividad</th>
                  <th className="px-4 py-3">Gestión de Acceso</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {sortedUsers.map((item) => {
                  const eventCount = countUserEvents(item.id, auditLogs);
                  const lastEvent = getLastUserEvent(item.id, auditLogs);
                  const isCurrentUser = item.id === user.id;

                  return (
                    <tr key={item.id} className="align-top hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sm font-bold text-sky-100">
                            {getInitials(item.full_name, item.email)}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-white">
                                {item.full_name ?? 'Usuario sin nombre'}
                              </p>

                              {isCurrentUser ? (
                                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[11px] font-bold text-sky-200">
                                  Tu usuario
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 truncate max-w-[140px] text-xs text-slate-300 sm:max-w-[200px] lg:max-w-[250px]" title={item.email ?? 'Sin email registrado'}>
                              {item.email ?? 'Sin email registrado'}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              Último acceso: {formatDate(item.last_login_at)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${roleTone(
                              item.role
                            )}`}
                          >
                            {roleLabel(item.role)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${statusTone(
                              item.status
                            )}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-bold text-white">
                          {eventCount} eventos
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Último:{' '}
                          {lastEvent ? formatAuditActionLabel(lastEvent.action) : 'Sin actividad'}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {!canManageAccess ? (
                          <span
                            title="Solo administradores pueden modificar accesos."
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-black text-slate-300"
                          >
                            i
                          </span>
                        ) : isCurrentUser ? (
                          <span
                            title="Usuario protegido. No podés modificar tu propio rol o estado desde este panel."
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/25 bg-sky-400/10 text-xs font-black text-sky-200"
                          >
                            i
                          </span>
                        ) : item.role === 'admin' ? (
                          <span
                            title="Administrador protegido. Solo el dueño de plataforma puede crear o reasignar este rol."
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-xs font-black text-amber-200"
                          >
                            i
                          </span>
                        ) : (
                          <form action={updateUserAccess} className="grid w-full min-w-[180px] max-w-[220px] gap-2">
                            <input type="hidden" name="user_id" value={item.id} />

                            <div>
                              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                Rol
                              </label>

                              <select
                                name="role"
                                defaultValue={item.role ?? 'employee'}
                                className="w-full rounded-xl border border-white/10 bg-[#071226] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-sky-400"
                              >
                                {roleOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                Estado
                              </label>

                              <select
                                name="status"
                                defaultValue={item.status ?? 'active'}
                                className="w-full rounded-xl border border-white/10 bg-[#071226] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-sky-400"
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <MotionButton
                              type="submit"
                              className="w-full bg-cyan-600 hover:bg-cyan-500"
                            >
                              Actualizar acceso
                            </MotionButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {sortedUsers.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">
                Todavía no hay usuarios registrados para esta organización.
              </div>
            ) : null}
          </div>
        </MotionCard>

        <section className="space-y-4 lg:w-[300px] lg:max-w-[300px]">
          <MotionCard index={5} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Roles
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Distribución de accesos
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">Administradores</p>
                </div>
                <span className="shrink-0 text-right text-xl font-bold text-white">
                  {adminUsers}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">Operadores</p>
                </div>
                <span className="shrink-0 text-right text-xl font-bold text-white">
                  {employeeUsers}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">Auditores</p>
                </div>
                <span className="shrink-0 text-right text-xl font-bold text-white">
                  {auditorUsers}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">Clientes</p>
                </div>
                <span className="shrink-0 text-right text-xl font-bold text-white">
                  {clientUsers}
                </span>
              </div>
            </div>
          </MotionCard>

          <MotionCard index={6} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Seguridad
            </p>

            <h3 className="mt-2 text-lg font-bold text-white">
              Administración protegida
            </h3>
          </MotionCard>

          <MotionCard index={7} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Gestión de accesos
            </p>

            <h3 className="mt-2 text-lg font-bold text-white">
              Invitaciones operativas
            </h3>

            <Link
              href="/usuarios/invitaciones"
              className="mt-4 inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.03] hover:bg-cyan-500 hover:shadow-cyan-500/40 active:scale-[0.97]"
            >
              Ver estado de invitaciones
            </Link>
          </MotionCard>
        </section>
      </div>
    </AppShell>
  );
}
