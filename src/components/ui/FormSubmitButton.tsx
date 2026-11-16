'use client';

import { useFormStatus } from 'react-dom';

/**
 * Botón de envío con estado propio del formulario que lo contiene:
 * se bloquea y anuncia el envío mientras la acción está pendiente.
 * Cada instancia refleja únicamente el estado de su formulario.
 */
export function FormSubmitButton({
  label,
  loadingLabel,
  className,
}: {
  label: string;
  loadingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  const defaultClassName =
    'rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-cyan-400';

  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? defaultClassName}
    >
      {pending ? (loadingLabel ?? 'Enviando…') : label}
    </button>
  );
}
