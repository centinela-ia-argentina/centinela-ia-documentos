import Link from 'next/link';
import { LogOut, Plus, Search, Upload } from 'lucide-react';
import { BackButton } from './BackButton';
import { signOut } from '@/app/login/actions';
import { canUploadDocument, isUserRole } from '@/lib/permissions/roles';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { getShellContext } from '@/lib/shell/getShellContext';

export async function Topbar() {
  const { profile, role, industry } = await getShellContext();
  const canUpload = isUserRole(profile?.role) && canUploadDocument(profile.role);
  const terms = getIndustryTerms(industry);
  const isRealEstate = industry === 'inmobiliaria';

  return (
    <header className="sticky top-[62px] z-20 border-b border-[#85E4D4]/15 bg-[#050B0C]/85 backdrop-blur-xl lg:top-0">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton />
          <Link
            href="/buscar"
            aria-label={`Buscar ${terms.expedienteSingular.toLowerCase()}, documento o cliente`}
            className="inline-flex h-10 min-w-10 items-center gap-3 rounded-lg border border-[#85E4D4]/15 bg-white/[0.025] px-3 text-[#9BB0A9] transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] sm:min-w-[270px] lg:min-w-[420px]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate text-sm sm:block">
              Buscar {terms.expedienteSingular.toLowerCase()}, documento o cliente
            </span>
            <kbd className="ml-auto hidden rounded border border-[#85E4D4]/15 px-1.5 py-0.5 text-[10px] text-[#6F827D] lg:inline">⌘ K</kbd>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isRealEstate ? (
            <Link
              href="/operaciones/nueva"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#C8FF62] px-3.5 text-sm font-extrabold text-[#071110] shadow-[0_10px_30px_rgba(200,255,98,0.12)] hover:bg-[#D5FF87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B0C]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva operación</span>
            </Link>
          ) : canUpload ? (
            <Link
              href="/documentos/subir"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#C8FF62] px-3.5 text-sm font-extrabold text-[#071110] hover:bg-[#D5FF87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4]"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Subir documento</span>
            </Link>
          ) : null}

          <form action={signOut}>
            <button
              aria-label="Cerrar sesión"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#85E4D4]/15 text-[#9BB0A9] hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
