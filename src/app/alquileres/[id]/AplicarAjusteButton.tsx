'use client';

import { useFormStatus } from 'react-dom';
import { aplicarAjusteAlquiler } from '../actions';

interface AplicarAjusteButtonProps {
  rentalId: string;
  montoLabel: string;
  expectedUpdatedAt: string;
}

function SubmitButton({ montoLabel }: { montoLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={(e) => {
        if (!pending && !window.confirm(`¿Confirmás aplicar el ajuste y actualizar el monto a ${montoLabel}?`)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Aplicando...' : 'Aplicar ajuste'}
    </button>
  );
}

export function AplicarAjusteButton({ rentalId, montoLabel, expectedUpdatedAt }: AplicarAjusteButtonProps) {
  return (
    <form action={aplicarAjusteAlquiler}>
      <input type="hidden" name="rental_id" value={rentalId} />
      <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
      <SubmitButton montoLabel={montoLabel} />
    </form>
  );
}
