import Link from 'next/link';
import NuevaContrasenaForm from './NuevaContrasenaForm';

interface NuevaContrasenaPageProps {
  searchParams: Promise<{
    estado?: string;
  }>;
}

function getStatusMessage(estado: string | null) {
  if (!estado) {
    return null;
  }

  const messages: Record<string, string> = {
    missing_fields: 'Completá la nueva contraseña y la confirmación.',
    password_too_short: 'La contraseña debe tener al menos 8 caracteres.',
    passwords_do_not_match: 'Las contraseñas ingresadas no coinciden.',
    session_required:
      'El enlace es inválido o venció. Solicitá uno nuevo.',
    update_failed:
      'No se pudo actualizar la contraseña. Intentá nuevamente o solicitá otro enlace.',
    updated:
      'La contraseña fue actualizada correctamente. Ya podés volver al login.',
  };

  return messages[estado] ?? null;
}

function getStatusType(estado: string | null) {
  if (!estado) {
    return 'neutral';
  }

  if (estado === 'updated') {
    return 'success';
  }

  if (
    estado === 'missing_fields' ||
    estado === 'password_too_short' ||
    estado === 'passwords_do_not_match' ||
    estado === 'session_required' ||
    estado === 'update_failed'
  ) {
    return 'error';
  }

  return 'neutral';
}

export default async function NuevaContrasenaPage({
  searchParams,
}: NuevaContrasenaPageProps) {
  const params = await searchParams;
  const estado = params.estado?.trim() ?? null;
const statusMessage = getStatusMessage(estado);
const statusType = getStatusType(estado);
const isUpdated = estado === 'updated';

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.45em] text-sky-300">
            Centinela IA
          </p>

          <h1 className="mt-8 max-w-2xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Nueva contraseña
          </h1>

          <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300">
            Esta pantalla permite definir una nueva contraseña después de abrir
            el enlace de recuperación enviado por email. Para completar el
            cambio, debe existir una sesión válida de recuperación.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 1
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                Abrir el enlace recibido por email.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 2
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                Ingresar y confirmar la nueva contraseña.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 3
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                Volver al login con el nuevo acceso.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-8 text-slate-950 shadow-2xl lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-sky-600">
            Restablecimiento
          </p>

          <h2 className="mt-5 text-2xl font-black">
            Definir nueva contraseña
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Ingresá una contraseña nueva y confirmala. Debe tener al menos 8
            caracteres.
          </p>

{statusMessage ? (
  <div
    className={`mt-5 rounded-2xl border p-4 text-sm font-bold leading-6 ${
      statusType === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : statusType === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
    }`}
  >
    {statusMessage}
  </div>
) : null}
{isUpdated ? (
  <div className="mt-8 space-y-5">
    <Link
      href="/login"
      className="block w-full rounded-2xl bg-slate-900 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-slate-800"
    >
      Ir al login
    </Link>

    <Link
      href="/recuperar-contrasena"
      className="block w-full rounded-2xl border border-slate-200 px-5 py-4 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
    >
      Solicitar otro enlace
    </Link>
  </div>
) : (
          <NuevaContrasenaForm />
        )}
        </div>
      </section>
    </main>
  );
}