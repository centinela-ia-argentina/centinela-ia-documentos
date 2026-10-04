import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getSafeValue,
  validateInvitation,
  type ValidationTone,
} from '@/lib/invitations/validateInvitation';

interface AcceptInvitationPageProps {
  searchParams: Promise<{
    email?: string;
    token?: string;
    estado?: string;
  }>;
}

function getToneClasses(tone: ValidationTone) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (tone === 'danger') return 'border-rose-200 bg-rose-50 text-rose-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getStatusPillClasses(tone: ValidationTone) {
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'bg-amber-50 text-amber-700';
  if (tone === 'danger') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    employee: 'Operador',
    auditor: 'Auditor',
    client: 'Cliente',
  };

  return labels[role] ?? role;
}

function getActionMessage(estado: string | null) {
  if (!estado) return null;

  const messages: Record<string, string> = {
    nombre_invalido: 'Ingresá tu nombre completo para crear la cuenta.',
    password_corta: 'La contraseña debe tener al menos 8 caracteres.',
    passwords_no_coinciden: 'Las contraseñas no coinciden.',
    email_no_coincide:
      'La sesión actual no coincide con el email invitado. Cerrá sesión e ingresá con el correo correcto.',
    invitacion_invalida:
      'La invitación no se puede aceptar porque ya no es válida.',
    configuracion_pendiente:
      'Falta una configuración privada del servidor para completar el alta.',
    error_validando_cuenta:
      'No se pudo comprobar si el correo ya tiene una cuenta.',
    cuenta_existente:
      'Este correo ya tiene una cuenta. Iniciá sesión y volvé a abrir el enlace de invitación.',
    error_creando_cuenta:
      'No se pudo crear la cuenta. Intentá nuevamente en unos minutos.',
    error_perfil: 'No se pudo revisar el perfil actual del usuario.',
    error_creando_perfil:
      'La cuenta no pudo asociarse a la organización invitada.',
    error_actualizando_perfil:
      'No se pudo actualizar el perfil para aceptar la invitación.',
    perfil_otra_organizacion:
      'El usuario ya está asociado a otra organización y no puede cambiarse desde una invitación.',
    perfil_creado_invitacion_no_actualizada:
      'No se pudo finalizar la invitación. La cuenta nueva fue revertida para evitar un alta incompleta.',
    organizacion_no_encontrada:
      'La organización de esta invitación no existe o no está disponible.',
    error_validando_duplicados:
      'No se pudo validar si ya existe otro perfil con este email.',
    perfil_email_existente:
      'Ya existe otro perfil registrado con este email.',
    cuenta_creada_login_pendiente:
      'La cuenta fue creada, pero no pudimos iniciar la sesión automáticamente. Ingresá desde el login con tu nueva contraseña.',
  };

  return messages[estado] ?? 'No se pudo completar la acción solicitada.';
}

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const params = await searchParams;
  const email = getSafeValue(params.email);
  const token = getSafeValue(params.token);
  const estado = getSafeValue(params.estado);
  const validation = await validateInvitation(email, token);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = user?.email ?? null;
  const normalizedUserEmail = userEmail?.trim().toLowerCase() ?? null;
  const normalizedInvitationEmail =
    validation.invitation?.email.trim().toLowerCase() ?? null;
  const isLoggedWithMatchingEmail =
    Boolean(normalizedUserEmail) &&
    Boolean(normalizedInvitationEmail) &&
    normalizedUserEmail === normalizedInvitationEmail;
  const actionMessage = getActionMessage(estado);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-sky-300">
            Anulus AI Documentos
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            Creá tu acceso seguro
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Este enlace reserva tu lugar dentro de una organización específica.
            Definí tu contraseña y Anulus AI asociará la cuenta al rol que te
            asignó el administrador.
          </p>

          <div className="mt-8 space-y-4">
            {[
              ['1', 'Validamos el correo, el token y el vencimiento.'],
              ['2', 'Creás tu cuenta con nombre y contraseña.'],
              ['3', 'Ingresás al espacio aislado de tu organización.'],
            ].map(([number, text]) => (
              <div
                key={number}
                className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400 font-black text-slate-950">
                  {number}
                </span>
                <p className="pt-1 text-sm font-bold leading-6">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-sky-300/20 bg-sky-300/10 p-5 text-sm leading-7 text-sky-100">
            El rol y la organización no se pueden elegir ni modificar desde esta
            pantalla: se toman exclusivamente de la invitación validada por el
            servidor.
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-600">
                Invitación de acceso
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight">
                {validation.title}
              </h2>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${getStatusPillClasses(validation.tone)}`}
            >
              {validation.tone === 'success'
                ? 'Válida'
                : validation.tone === 'danger'
                  ? 'Bloqueada'
                  : 'Revisar'}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            {validation.message}
          </p>

          {actionMessage ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              {actionMessage}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Email invitado
              </p>
              <p className="mt-2 break-all text-sm font-bold">
                {validation.emailLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Rol asignado
              </p>
              <p className="mt-2 text-sm font-bold">
                {getRoleLabel(validation.roleLabel)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Vencimiento
              </p>
              <p className="mt-2 text-sm font-bold">{validation.expiresLabel}</p>
            </div>
          </div>

          <div
            className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${getToneClasses(validation.tone)}`}
          >
            {validation.canAccept
              ? 'La invitación está lista. Tus permisos y tu organización quedarán fijados al completar el alta.'
              : 'La invitación no puede continuar al alta de usuario.'}
          </div>

          {validation.canAccept && !user ? (
            <form
              action="/invitacion/aceptar/confirmar"
              method="post"
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="email" value={email ?? ''} />
              <input type="hidden" name="token" value={token ?? ''} />

              <label className="block text-sm font-black text-slate-700">
                Nombre completo
                <input
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  placeholder="Tu nombre y apellido"
                />
              </label>

              <label className="block text-sm font-black text-slate-700">
                Contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  placeholder="Mínimo 8 caracteres"
                />
              </label>

              <label className="block text-sm font-black text-slate-700">
                Repetir contraseña
                <input
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  placeholder="Repetí la contraseña"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-sky-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-sky-600"
              >
                Crear cuenta y aceptar invitación
              </button>
            </form>
          ) : null}

          {validation.canAccept && user && isLoggedWithMatchingEmail ? (
            <form
              action="/invitacion/aceptar/confirmar"
              method="post"
              className="mt-6"
            >
              <input type="hidden" name="email" value={email ?? ''} />
              <input type="hidden" name="token" value={token ?? ''} />
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700"
              >
                Aceptar invitación con esta cuenta
              </button>
            </form>
          ) : null}

          {validation.canAccept && user && !isLoggedWithMatchingEmail ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-900">
              La sesión actual pertenece a {userEmail}. Cerrá sesión para crear o
              usar la cuenta de {validation.emailLabel}.
              <Link
                href="/logout"
                className="mt-3 block w-full rounded-xl bg-rose-600 px-4 py-2.5 text-center text-white"
              >
                Cerrar sesión
              </Link>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Ya tengo cuenta
            </Link>
            <Link
              href="/"
              className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
