import Link from 'next/link';
import {
  CaretDown,
  GearSix,
  MagnifyingGlass,
  Plus,
  SignOut,
  UploadSimple,
  UserCircle,
} from '@phosphor-icons/react/ssr';
import { BackButton } from './BackButton';
import { signOut } from '@/app/login/actions';
import { canUploadDocument, isUserRole } from '@/lib/permissions/roles';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { getShellContext } from '@/lib/shell/getShellContext';

export async function Topbar() {
  const { profile, role, industry, organizationName } = await getShellContext();
  const canUpload = isUserRole(profile?.role) && canUploadDocument(profile.role);
  const terms = getIndustryTerms(industry);
  const isRealEstate = industry === 'inmobiliaria';
  const accountName = organizationName || profile?.full_name?.trim() || 'Cuenta Anulus';
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'auditor' ? 'Auditor' : 'Colaborador';
  const initials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-[62px] z-20 border-b border-[#85E4D4]/15 bg-[#050B0C]/90 backdrop-blur-xl lg:top-0">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton />
          <Link
            href="/buscar"
            aria-label={`Buscar ${terms.expedienteSingular.toLowerCase()}, documento o cliente`}
            className="inline-flex h-10 min-w-10 items-center gap-3 rounded-md border border-[#85E4D4]/15 bg-white/[0.025] px-3 text-[#9BB0A9] transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] sm:min-w-[270px] lg:min-w-[420px]"
          >
            <MagnifyingGlass size={17} weight="regular" className="shrink-0" />
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
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#C8FF62] px-4 text-sm font-extrabold text-[#071110] hover:bg-[#D5FF87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B0C]"
            >
              <Plus size={17} weight="bold" />
              <span className="hidden sm:inline">Nueva operación</span>
            </Link>
          ) : canUpload ? (
            <Link
              href="/documentos/subir"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#C8FF62] px-4 text-sm font-extrabold text-[#071110] hover:bg-[#D5FF87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4]"
            >
              <UploadSimple size={17} weight="bold" />
              <span className="hidden sm:inline">Subir documento</span>
            </Link>
          ) : null}

          <details className="group relative">
            <summary
              aria-label="Abrir menú de cuenta"
              className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-[#85E4D4]/15 bg-white/[0.025] px-2 text-[#D7E2DE] hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] [&::-webkit-details-marker]:hidden"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md border border-[#85E4D4]/20 bg-[#85E4D4]/[0.06] text-[9px] font-black text-[#C8FF62]">
                {initials || 'AN'}
              </span>
              <span className="hidden max-w-32 truncate text-xs font-semibold xl:block">{accountName}</span>
              <CaretDown size={13} weight="bold" className="hidden transition-transform group-open:rotate-180 sm:block" />
            </summary>

            <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl border border-[#85E4D4]/15 bg-[#0B1918] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
              <div className="flex items-center gap-3 px-3 py-3">
                <UserCircle size={30} weight="light" className="text-[#85E4D4]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{accountName}</p>
                  <p className="mt-0.5 text-[11px] text-[#7F938D]">{roleLabel}</p>
                </div>
              </div>
              <div className="border-t border-[#85E4D4]/15 pt-1.5">
                <Link href="/configuracion" className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[#B7C5C0] hover:bg-white/[0.05] hover:text-white">
                  <GearSix size={16} weight="regular" /> Ajustes de cuenta
                </Link>
                <form action={signOut}>
                  <button className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium text-[#B7C5C0] hover:bg-white/[0.05] hover:text-white">
                    <SignOut size={16} weight="regular" /> Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
