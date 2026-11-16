'use client';

import { useEffect, useState } from 'react';

export function AvisoPrivacidadIA({ contexto = 'esta función' }: { contexto?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(localStorage.getItem('centinela_aviso_ia') !== 'ok');
  }, []);

  if (!visible) return null;

  return (
    <div className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-neutral-500">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>
        <b className="text-neutral-600">Privacidad:</b> para {contexto}, tu consulta y el texto de
        tus documentos se procesan con un servicio de IA de Google (Gemini). Evitá cargar
        información que no debas compartir con un proveedor externo.{' '}
        <button
          onClick={() => {
            localStorage.setItem('centinela_aviso_ia', 'ok');
            setVisible(false);
          }}
          className="font-bold text-neutral-900 underline-offset-2 hover:underline"
        >
          Entendido
        </button>
      </span>
    </div>
  );
}
