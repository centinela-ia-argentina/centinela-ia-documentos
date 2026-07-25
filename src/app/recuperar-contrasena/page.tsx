import Link from 'next/link';
import { sendPasswordRecoveryLink } from './actions';
interface RecuperarContrasenaPageProps {
  searchParams: Promise<{
    estado?: string;
  }>;
}

function getStatusMessage(estado: string | null) {
  if (!estado) {
    return null;
  }

  const messages: Record<string, string> = {
    missing_email: 'Ingresá un email para solicitar la recuperación.',
    invalid_email: 'El email ingresado no tiene un formato válido.',
    invalid_or_expired: 'El enlace de recuperación es inválido, venció o ya fue utilizado.',
    send_failed:
      'No se pudo enviar el enlace de recuperación. Revisá el email o intentá nuevamente.',
    sent:
      'Si el email corresponde a una cuenta registrada, recibirás un enlace de recuperación.',
  };

  return messages[estado] ?? null;
}

function getStatusType(estado: string | null) {
  if (!estado) {
    return 'neutral';
  }

  if (estado === 'sent') {
    return 'success';
  }

  if (
    estado === 'missing_email' ||
    estado === 'invalid_email' ||
    estado === 'invalid_or_expired' ||
    estado === 'send_failed'
  ) {
    return 'error';
  }

  return 'neutral';
}

export default async function RecuperarContrasenaPage({
  searchParams,
}: RecuperarContrasenaPageProps) {
  const params = await searchParams;
  const estado = params.estado?.trim() ?? null;
  const statusMessage = getStatusMessage(estado);
  const statusType = getStatusType(estado);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl lg:p-12">
          <p className="text-xs font-black uppercase tracking-[0.45em] text-sky-300">
            Centinela IA
          </p>

          <h1 className="mt-8 max-w-2xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Recuperar contraseña
          </h1>

          <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300">
             Esta pantalla permite solicitar un enlace seguro para restablecer
             el acceso al panel. Si el email corresponde a una cuenta registrada,
             el sistema enviará un enlace de recuperación mediante Supabase Auth.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 1
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                El usuario ingresa su email.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 2
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                Supabase enviará un enlace seguro.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-300">
                Paso 3
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-white">
                El usuario define una nueva contraseña.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-8 text-slate-950 shadow-2xl lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-sky-600">
            Acceso seguro
          </p>

          <h2 className="mt-5 text-2xl font-black">
            Solicitar recuperación
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-600">
             Ingresá el email asociado a tu usuario. Si la cuenta existe, recibirás
             un enlace seguro para continuar el restablecimiento.
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

          <form action={sendPasswordRecoveryLink} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Email</span>
              <input
                type="email"
                name="email"
                placeholder="usuario@empresa.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
              />
            </label>

            <button
               type="submit"
               className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800"
            >
               Enviar enlace de recuperación
              </button>

            <Link
              href="/login"
              className="block w-full rounded-2xl border border-slate-200 px-5 py-4 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
            >
              Volver al login
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}