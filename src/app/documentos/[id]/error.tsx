'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './Viewer.module.css';

export default function DocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Document detail error:', error);
  }, [error]);

  return (
    <div className={styles.root}>
      <div className="mb-6 rounded-full bg-rose-500/10 p-4">
        <svg
          className="h-10 w-10 text-rose-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 className="mb-3 text-2xl font-semibold text-[#272b2e]">
        No se pudo cargar este documento
      </h2>

      <p className="mb-8 max-w-md text-[#697580]">
        Ocurrió un error al intentar leer o procesar la información de este
        expediente o documento. Podés intentar recargar la información.
      </p>

      <div className={styles.panel}>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200"
        >
          Reintentar
        </button>
        
        <Link
          href="/documentos"
          className="ml-3"
        >
          Volver a documentos
        </Link>
      </div>
    </div>
  );
}
