'use client';

import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { updateRecoveredPassword } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Actualizando...' : 'Actualizar contraseña'}
    </button>
  );
}

export default function NuevaContrasenaForm() {
  return (
    <form action={updateRecoveredPassword} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-sm font-bold text-slate-700">Nueva contraseña</span>
        <input
          type="password"
          name="password"
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-slate-700">Confirmar contraseña</span>
        <input
          type="password"
          name="confirmPassword"
          placeholder="Repetí la nueva contraseña"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
        />
      </label>

      <SubmitButton />

      <Link
        href="/recuperar-contrasena"
        className="block w-full rounded-2xl border border-slate-200 px-5 py-4 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
      >
        Solicitar otro enlace
      </Link>

      <Link
        href="/login"
        className="block w-full rounded-2xl border border-slate-200 px-5 py-4 text-center text-sm font-black text-slate-800 transition hover:bg-slate-50"
      >
        Volver al login
      </Link>
    </form>
  );
}
