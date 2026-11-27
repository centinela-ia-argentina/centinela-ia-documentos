'use client';

import { useState } from 'react';
import { Check, Copy, NotePencil } from '@phosphor-icons/react/dist/ssr';

export function NotaPendientesPanel({ texto }: { texto: string }) {
  const [valor, setValor] = useState(texto);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section
      data-testid="nota-pendientes"
      className="rounded-2xl border border-[#e4e5e3] bg-white p-4 shadow-sm"
      aria-labelledby="nota-pendientes-title"
    >
      <h2 id="nota-pendientes-title" className="flex items-center gap-2 text-base font-semibold text-[#25272a]">
        <NotePencil size={18} aria-hidden /> Nota de pendientes para el cliente
      </h2>
      <p className="mt-1 text-sm text-[#62676d]">
        Borrador armado desde el checklist y los vencimientos del legajo. Editalo a gusto, copialo y envíalo vos por el canal que prefieras. La plataforma no envía nada.
      </p>
      <label className="sr-only" htmlFor="nota-pendientes-texto">Texto de la nota</label>
      <textarea
        id="nota-pendientes-texto"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        rows={10}
        data-testid="nota-pendientes-texto"
        className="mt-3 w-full rounded-xl border border-[#d9d9d6] bg-white p-3 text-sm text-[#25272a] focus:border-[#415a71] focus:outline-none focus:ring-2 focus:ring-[#415a71]/25"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={copiar}
          data-testid="nota-pendientes-copiar"
          className="inline-flex items-center gap-2 rounded-lg border border-[#d9d9d6] bg-white px-3 py-1.5 text-sm font-medium text-[#25272a] hover:bg-[#f1f1ef]"
        >
          {copiado ? <><Check size={14} aria-hidden className="text-[#1f7a4d]" /> Copiado</> : <><Copy size={14} aria-hidden /> Copiar nota</>}
        </button>
        <span className="text-xs text-[#8a8f94]">{valor.length} caracteres</span>
      </div>
    </section>
  );
}
