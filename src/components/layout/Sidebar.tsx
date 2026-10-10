import type { ReactNode } from 'react';
import Link from 'next/link';
import { List, X } from '@phosphor-icons/react/ssr';
import { navigation } from '@/config/navigation';
import { BrandWordmark } from '@/components/BrandWordmark';
import { ActiveNavLink } from './ActiveNavLink';
import { getNavGroupLabel, getNavItemLabel } from '@/lib/industries/uiLabels';
import { getShellContext } from '@/lib/shell/getShellContext';

const groupOrder = ['Operación', 'Herramientas jurídicas', 'Utilidades', 'Gestión'];

export async function Sidebar() {
  const { role, industry } = await getShellContext();

  const visibleNavigation = role
    ? navigation.filter(
        (item) =>
          item.roles.includes(role) &&
          (!item.industries || item.industries.includes(industry))
      )
    : [];

  const renderNavigation = (keyPrefix: string): ReactNode => (
    <nav aria-label="Navegación principal" className="flex h-full flex-col justify-between gap-2">
      {groupOrder.map((group) => {
        const items = visibleNavigation
          .filter((item) => item.group === group)
          .sort((a, b) =>
            getNavItemLabel(a, industry).localeCompare(
              getNavItemLabel(b, industry),
              'es'
            )
          );

        if (items.length === 0) return null;

        return (
          <section key={`${keyPrefix}-${group}`} aria-labelledby={`${keyPrefix}-${group.replaceAll(' ', '-')}`}>
            <h2
              id={`${keyPrefix}-${group.replaceAll(' ', '-')}`}
              className="mb-1 px-2.5 text-[10px] font-medium tracking-[-0.01em] text-[#71857F]"
            >
              {getNavGroupLabel(group, industry)}
            </h2>
            <div>
              {items.map((item) => {
                const Icon = item.icon;
                const href =
                  industry === 'inmobiliaria' && item.href === '/expedientes'
                    ? '/operaciones'
                    : item.href;

                return (
                  <ActiveNavLink
                    key={`${keyPrefix}-${href}`}
                    href={href}
                    label={getNavItemLabel(item, industry)}
                  >
                    <Icon size={17} weight="regular" />
                  </ActiveNavLink>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-[#85E4D4]/15 bg-[#071110] lg:flex">
        <Link href="/dashboard" className="px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#85E4D4]">
          <BrandWordmark className="text-lg" />
        </Link>
        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-4">
          {renderNavigation('desktop')}
        </div>
      </aside>

      <details className="group sticky top-0 z-40 border-b border-[#85E4D4]/15 bg-[#071110]/95 backdrop-blur-xl lg:hidden">
        <summary className="flex h-[62px] cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
          <BrandWordmark className="text-base" />
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#85E4D4]/15 text-[#9BB0A9] group-open:bg-white/[0.05] group-open:text-white">
            <List size={20} weight="regular" className="group-open:hidden" aria-hidden="true" />
            <X size={20} weight="regular" className="hidden group-open:block" aria-hidden="true" />
            <span className="sr-only">Abrir o cerrar menú</span>
          </span>
        </summary>
        <div className="max-h-[calc(100vh-62px)] overflow-y-auto border-t border-[#85E4D4]/15 px-4 py-5">
          {renderNavigation('mobile')}
        </div>
      </details>
    </>
  );
}
