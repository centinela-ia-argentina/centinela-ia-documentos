import Link from 'next/link';
import { signIn } from './actions';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; password_updated?: string }>;
}

function getErrorMessage(error?: string) {
  if (error === 'missing_fields') return 'Completá email y contraseña.';
  if (error === 'invalid_credentials') return 'Email o contraseña incorrectos.';
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);
  const passwordUpdated = params.password_updated === '1';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,155,240,0.28)_0%,_#0C2340_34%,_#0A1830_78%)] px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.065] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-bold text-[#C2CCD9] transition-colors hover:text-[#1E9BF0]"
        >
          Volver al inicio
        </Link>

        <Link
          href="/"
          className="mx-auto mb-4 mt-2 flex max-w-xs justify-center overflow-visible"
          aria-label="Volver al inicio de Centinela IA"
        >
          <img
            src="/brand/centinela-logo-transparent.png"
            alt="Centinela IA"
            className="h-36 w-full object-contain"
          />
        </Link>

        <h1 className="text-3xl font-bold text-white">Ingresar al panel</h1>

        <p className="mt-2 text-sm leading-6 text-[#C2CCD9]">
          Acceso privado para organizaciones y usuarios autorizados.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {passwordUpdated ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
            Contraseña actualizada. Ya podés ingresar con tu nueva contraseña.
          </div>
        ) : null}

        <form action={signIn} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#C2CCD9]">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071326]/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#29C5FF] focus:ring-2 focus:ring-sky-400"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-semibold text-[#C2CCD9]">
                Contraseña
              </label>

              <Link
                href="/recuperar-contrasena"
                className="text-xs font-semibold text-[#29C5FF] hover:text-sky-200"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <input
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071326]/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#29C5FF] focus:ring-2 focus:ring-sky-400"
              placeholder="••••••••"
            />
          </div>

          <button className="w-full rounded-2xl bg-[#1E9BF0] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(30,155,240,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#1485D6] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-[#0A1830]">
            Ingresar
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          El acceso está limitado a usuarios autorizados por la organización.
        </p>
      </div>
    </main>
  );
}
