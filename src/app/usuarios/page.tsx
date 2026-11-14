import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { formatAuditActionLabel } from '@/lib/audit/actionLabels';
import { roleOptions, roleLabel, roleDescription, roleTone } from '@/lib/permissions/roleDisplay';
import { updateUserAccess } from './actions';
import { MotionCard } from '@/components/ui/MotionCard';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { getIndustryTerms } from '@/lib/industries/uiLabels';

interface UsuariosPageProps {
  searchParams: Promise<{
    success?: string;
    error?: string;
    filtro?: string;
    q?: string;
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
    timeZone: 'America/Buenos_Aires',
  }).format(date);
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
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'invited') return 'bg-amber-50 text-amber-800 border-amber-200';

  // Inactivo y estados desconocidos se presentan neutrales, no como error.
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
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

/* Íconos de trazo fino (Phosphor) — 16px, stroke 1.8 */
function PersonIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3Z" strokeLinejoin="round" />
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

function CheckCircleIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" strokeLinecap="round" />
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

function CheckIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <PersonIcon className={className} />;
}

function BoxIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 2 3 7l9 5 9-5-9-5Z" strokeLinejoin="round" />
      <path d="M3 7v10c0 1 1 2 2 2h14c1 0 2-1 2-2V7" />
    </svg>
  );
}

function SearchIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 12v5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* Botón de acción de fila: ancho fijo para simetría perfecta entre filas */
const ACTION_BTN_CLASS =
  'inline-flex h-8 w-[112px] items-center justify-center rounded-lg text-[12px] font-bold transition-colors';

function ActionButton({
  href,
  children,
  tone = 'ghost',
}: {
  href: string;
  children: React.ReactNode;
  tone?: 'ghost' | 'solid' | 'warn';
}) {
  const tones = {
    ghost: 'border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400',
    solid: 'bg-neutral-900 text-white hover:bg-neutral-700',
    warn: 'border border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400',
  } as const;

  return (
    <Link href={href} className={`${ACTION_BTN_CLASS} ${tones[tone]}`}>
      {children}
    </Link>
  );
}

function RolePill({ role }: { role?: string | null }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-[12px] font-bold text-white">
        <ShieldIcon /> Administrador
      </span>
    );
  }

  if (role === 'employee') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e2f5] bg-[#eef2fb] px-3 py-1 text-[12px] font-bold text-[#2b4a9e]">
        <BriefcaseIcon /> Operador
      </span>
    );
  }

  if (role === 'auditor') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5dcf5] bg-[#f4f0fb] px-3 py-1 text-[12px] font-bold text-[#5b3a9e]">
        <CheckCircleIcon /> Auditor
      </span>
    );
  }

  if (role === 'client') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e5cc] bg-[#fbf4e8] px-3 py-1 text-[12px] font-bold text-[#8a6414]">
        <PersonIcon className="h-3.5 w-3.5" /> Cliente
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[12px] font-bold text-neutral-600">
      <MinusIcon /> Sin definir
    </span>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5f0de] bg-[#eefaf1] px-3 py-1 text-[12px] font-semibold text-[#1f7a3d]">
        <CheckIcon /> Activo
      </span>
    );
  }

  if (status === 'invited') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e5cc] bg-[#fbf4e8] px-3 py-1 text-[12px] font-semibold text-[#8a6414]">
        <BellIcon /> Invitado
      </span>
    );
  }

  // Inactivo y estados desconocidos se presentan neutrales, no como error.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[12px] font-semibold text-neutral-600">
      <MinusIcon /> {statusLabel(status)}
    </span>
  );
}

function AvatarPerson({ title }: { title: string }) {
  return (
    <div
      title={title}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-neutral-200 bg-white text-neutral-900"
    >
      <PersonIcon className="h-5 w-5" />
    </div>
  );
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

  const [profilesResult, auditLogsResult, orgResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, organization_id, full_name, email, role, status, last_login_at, created_at, updated_at'
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('id, user_id, action, resource_type, resource_id, metadata, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('organizations')
      .select('industry_type')
      .eq('id', profile.organization_id)
      .single()
  ]);

  const organizationIndustry = orgResult.data?.industry_type || 'general';
  const terms = getIndustryTerms(organizationIndustry as any);

  const users = (profilesResult.data ?? []) as ProfileRecord[];
  const auditLogs = (auditLogsResult.data ?? []) as AuditLogRecord[];
  const profilesUnavailable = Boolean(profilesResult.error);

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

  const filtro = params.filtro ?? 'todos';
  const query = (params.q ?? '').trim().toLowerCase();

  const filteredUsers = profilesUnavailable
    ? sortedUsers
    : sortedUsers.filter((item) => {
        if (filtro === 'operadores' && item.role !== 'employee') return false;
        if (filtro === 'auditores' && item.role !== 'auditor') return false;
        if (filtro === 'clientes' && item.role !== 'client') return false;
        if (filtro === 'inactivos' && item.status !== 'inactive') return false;
        if (query) {
          const haystack = `${item.full_name ?? ''} ${item.email ?? ''}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });

  const filtroLinks: { key: string; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'operadores', label: 'Operadores' },
    { key: 'auditores', label: 'Auditores' },
    { key: 'clientes', label: 'Clientes' },
    { key: 'inactivos', label: 'Inactivos' },
  ];

  const filterParams = (key: string) => {
    const next = new URLSearchParams();
    if (key !== 'todos') next.set('filtro', key);
    if (query) next.set('q', query);
    const qs = next.toString();
    return qs ? `/usuarios?${qs}` : '/usuarios';
  };

  const metrics = [
    {
      label: 'Usuarios',
      value: profilesUnavailable ? ('—' as unknown as number) : users.length,
      helper: 'Perfiles de la organización',
      action: { label: 'Ver usuarios', href: '/usuarios' },
      icon: <UsersIcon className="h-4 w-4" />,
    },
    {
      label: 'Operadores',
      value: profilesUnavailable ? ('—' as unknown as number) : employeeUsers,
      helper: 'Rol de trabajo',
      action: { label: 'Ver operadores', href: '/usuarios?filtro=operadores' },
      icon: <BriefcaseIcon className="h-4 w-4" />,
    },
    {
      label: 'Auditores',
      value: profilesUnavailable ? ('—' as unknown as number) : auditorUsers,
      helper: 'Rol de revisión',
      action: { label: 'Ver auditores', href: '/usuarios?filtro=auditores' },
      icon: <CheckCircleIcon className="h-4 w-4" />,
    },
    {
      label: 'Clientes',
      value: profilesUnavailable ? ('—' as unknown as number) : clientUsers,
      helper: 'Acceso externo',
      action: { label: 'Ver clientes', href: '/usuarios?filtro=clientes' },
      icon: <BoxIcon className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            Espacio de trabajo · Inmobiliaria
          </p>

          <h2
            data-testid="users-page-title"
            className="mt-2 text-3xl font-bold tracking-tight text-neutral-900"
          >
            Usuarios
          </h2>

          <p className="mt-2 text-[13px] text-neutral-500">
            Personas con acceso a este espacio de trabajo, roles, y estados de invitación de la organización.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/usuarios/invitaciones"
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-neutral-700"
          >
            Gestionar invitaciones
          </Link>

          <Link
            href="/reportes?vista=auditoria"
            className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900 transition-colors hover:border-neutral-400"
          >
            Ver auditoría
          </Link>

          <Link
            href="/documentos"
            className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900 transition-colors hover:border-neutral-400"
          >
            Ir a la Bóveda
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
        {metrics.map((metric, idx) => (
          <MotionCard
            key={metric.label}
            index={idx}
            className="border border-neutral-200 bg-white p-5 hover:border-neutral-400"
          >
            <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-500">
              {metric.icon}
              {metric.label}
            </div>

            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">{metric.value}</p>

            <p className="mt-1 text-[12px] text-neutral-500">{metric.helper}</p>

            <Link
              href={metric.action.href}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition-colors hover:border-neutral-400"
            >
              {metric.action.label}
            </Link>
          </MotionCard>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filtroLinks.map((item) => (
          <Link
            key={item.key}
            href={filterParams(item.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              filtro === item.key
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
            }`}
          >
            {item.label}
          </Link>
        ))}

        <form action="/usuarios" method="GET" className="ml-auto flex items-center">
          {filtro !== 'todos' ? <input type="hidden" name="filtro" value={filtro} /> : null}
          <div className="flex h-9 w-56 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 text-neutral-400">
            <SearchIcon />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Buscar por nombre o email"
              className="w-full bg-transparent text-[13px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
        </form>
      </div>

      <MotionCard index={4} className="mt-4 border border-neutral-200 bg-white p-6 hover:border-neutral-400">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <h3 className="text-[15px] font-bold text-neutral-900">
              Directorio de personas
            </h3>
          </div>

          <span className="text-[12px] font-semibold text-neutral-400">
            {profilesUnavailable ? '—' : `${users.length} ${users.length === 1 ? 'persona' : 'personas'} · actividad limitada a los últimos 80 eventos de la organización`}
          </span>
        </div>

        {profilesUnavailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            No se pudieron consultar los perfiles de la organización. El directorio no se presenta como vacío hasta confirmar el estado real de la consulta.
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_150px_140px_250px] gap-3.5 px-1 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-neutral-400">
              <div>Persona</div>
              <div>Rol</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>

            {filteredUsers.map((item) => {
              const eventCount = countUserEvents(item.id, auditLogs);
              const lastEvent = getLastUserEvent(item.id, auditLogs);
              const isCurrentUser = item.id === user.id;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_150px_140px_250px] items-center gap-3.5 border-t border-neutral-100 px-1 py-4"
                >
                  <div className="flex items-center gap-3">
                    <AvatarPerson title={isCurrentUser ? 'Tu usuario' : roleLabel(item.role)} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] font-bold text-neutral-900">
                          {item.full_name ?? 'Usuario sin nombre'}
                        </p>
                      </div>

                      <p className="mt-0.5 truncate max-w-[200px] text-[12px] text-neutral-400" title={item.email ?? 'Sin email registrado'}>
                        {item.email ?? 'Sin email registrado'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <RolePill role={item.role} />
                  </div>

                  <div>
                    <StatusPill status={item.status} />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <ActionButton href="/usuarios/invitaciones" tone="ghost">
                      Ver actividad
                    </ActionButton>

                    {item.role === 'client' || item.role === 'employee' ? (
                      <ActionButton href="/propiedades" tone="solid">
                        Ver propiedades
                      </ActionButton>
                    ) : (
                      <ActionButton href="/usuarios/invitaciones" tone="ghost">
                        Ver propiedad
                      </ActionButton>
                    )}

                    {!canManageAccess ? null : isCurrentUser ? (
                      <span
                        title="Usuario protegido. No podés modificar tu propio rol o estado desde este panel."
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d9e2f5] bg-[#eef2fb] text-[#2b4a9e]"
                      >
                        <InfoIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : item.role === 'admin' ? (
                      <span
                        title="Administrador protegido. Solo el dueño de plataforma puede crear o reasignar este rol."
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f0e5cc] bg-[#fbf4e8] text-[#8a6414]"
                      >
                        <InfoIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <form action={updateUserAccess} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={item.id} />
                        <input type="hidden" name="role" value={item.role ?? ''} />
                        <input type="hidden" name="status" value={item.status === 'active' ? 'inactive' : 'active'} />
                        <FormSubmitButton
                          label={item.status === 'active' ? 'Desactivar' : 'Habilitar'}
                          loadingLabel="Actualizando…"
                          className="inline-flex h-8 w-[112px] items-center justify-center rounded-lg border border-emerald-200 bg-white text-[12px] font-bold text-emerald-700 transition-colors hover:border-emerald-400"
                        />
                      </form>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 ? (
              <div className="border-t border-neutral-100 py-6 text-sm text-neutral-500">
                {profilesUnavailable
                  ? 'No se pudo confirmar el estado del directorio.'
                  : 'Sin resultados para este filtro o búsqueda.'}
              </div>
            ) : null}
          </div>
        )}
      </MotionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MotionCard index={5} className="p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-neutral-900">
            <ShieldIcon className="h-4 w-4" /> Distribución de roles
          </h3>

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">
            {adminUsers} administradores · {employeeUsers} operadores · {auditorUsers} auditores · {clientUsers} clientes. Los operadores administran y, los auditores se pueden revisar. Los clientes pueden revisar tus propiedades.
          </p>
        </MotionCard>

        <MotionCard index={6} className="p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-neutral-900">
            <LockIcon className="h-4 w-4" /> Seguridad de acceso
          </h3>

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">
            Cada administrador y operador se puede, con la actividad del sistema. Todos los espacios confirmados.
          </p>

          <Link
            href="/configuracion/seguridad-cuenta"
            className="mt-2 inline-flex text-[13px] font-bold text-neutral-900 underline-offset-4 hover:underline"
          >
            → Ir a Seguridad de la cuenta
          </Link>
        </MotionCard>
      </div>
    </AppShell>
  );
}
