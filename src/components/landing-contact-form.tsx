'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';

const industries = [
  'Estudio jurídico',
  'Inmobiliaria',
  'Escribanía',
  'Empresa',
  'Otro',
];

export function LandingContactForm() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const message = [
      'Hola, quiero consultar por Anulus AI.',
      '',
      `Nombre: ${String(formData.get('name') ?? '')}`,
      `Organización: ${String(formData.get('organization') ?? '')}`,
      `Email: ${String(formData.get('email') ?? '')}`,
      `Rubro: ${String(formData.get('industry') ?? '')}`,
    ].join('\n');

    const url = `https://wa.me/543794733321?text=${encodeURIComponent(message)}`;
    const whatsappWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (whatsappWindow) whatsappWindow.opener = null;
  };

  const fieldClassName =
    'mt-2 w-full rounded-xl border border-white/10 bg-[#08172d] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20';

  return (
    <form onSubmit={handleSubmit} className="premium-card rounded-2xl border border-white/10 bg-white/[0.055] p-6 shadow-[0_22px_55px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-200">
          Nombre
          <input name="name" type="text" autoComplete="name" required className={fieldClassName} />
        </label>

        <label className="text-sm font-bold text-slate-200">
          Organización
          <input name="organization" type="text" autoComplete="organization" required className={fieldClassName} />
        </label>

        <label className="text-sm font-bold text-slate-200">
          Email
          <input name="email" type="email" autoComplete="email" required className={fieldClassName} />
        </label>

        <label className="text-sm font-bold text-slate-200">
          Rubro
          <select name="industry" required defaultValue="" className={fieldClassName}>
            <option value="" disabled>
              Seleccioná una opción
            </option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-400">
        <input name="privacy" type="checkbox" required className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-500" />
        <span>
          Acepto que estos datos se utilicen para responder mi consulta, según la{' '}
          <Link href="/privacidad" className="font-bold text-sky-300 hover:text-sky-200">
            Política de privacidad
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        className="premium-primary-button mt-6 w-full rounded-xl bg-[#1E9BF0] px-5 py-3 text-sm font-black text-[#061426] shadow-[0_12px_32px_rgba(30,155,240,0.22)] sm:w-auto"
      >
        Enviar consulta por WhatsApp
      </button>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Al enviar, se abrirá WhatsApp con los datos completados. La landing no guarda este formulario.
      </p>
    </form>
  );
}
