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
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <span className="mt-0.5">🔒</span>
      <div className="flex-1">
        <p className="font-semibold text-amber-800">Aviso de privacidad</p>
        <p className="mt-0.5 text-amber-700">
          Para {contexto}, el texto de tus documentos y tu consulta se procesan con un servicio de
          inteligencia artificial de Google (Gemini). Evitá cargar información que no debas
          compartir con un proveedor externo. Los datos se usan únicamente para generar la respuesta.
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem('centinela_aviso_ia', 'ok');
          setVisible(false);
        }}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      >
        Entendido
      </button>
    </div>
  );
}
