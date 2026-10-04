'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Rutas de nivel principal donde NO se muestra el botón "Volver"
const HOME_ROUTES = ['/dashboard'];

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // En la pantalla principal (Inicio) no se muestra
  if (HOME_ROUTES.includes(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver atrás"
      className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[#85E4D4]/15 bg-white/[0.025] px-3 py-2 text-sm font-semibold text-[#9BB0A9] transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4]"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver
    </button>
  );
}
