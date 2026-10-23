import type { ReactNode } from 'react';
import Link from 'next/link';
import { CaretDown, GearSix, SignOut } from '@phosphor-icons/react/ssr';
import { navigation } from '@/config/navigation';
import { brand } from '@/config/brand';
import { signOut } from '@/app/login/actions';
import { ActiveNavLink } from './ActiveNavLink';
import { MobileNavigation } from './MobileNavigation';
import { AccountMenu } from './AccountMenu';
import { getNavGroupLabel, getNavItemLabel } from '@/lib/industries/uiLabels';
import { getShellContext } from '@/lib/shell/getShellContext';
import styles from './Shell.module.css';

const groupOrder = ['Operación', 'Herramientas jurídicas', 'Utilidades', 'Gestión'];

export async function Sidebar() {
  const { profile, role, industry, organizationName } = await getShellContext();
  const visibleNavigation = role ? navigation.filter((item) =>
    item.roles.includes(role) && (!item.industries || item.industries.includes(industry))) : [];
  const accountName = organizationName || profile?.full_name?.trim() || 'Cuenta Anulus';
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'auditor' ? 'Auditor' : 'Colaborador';
  const initials = accountName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();

  const renderNavigation = (keyPrefix: string): ReactNode => (
    <nav aria-label="Navegación principal">
      {groupOrder.map((group) => {
        const items = visibleNavigation.filter((item) => item.group === group).sort((a, b) =>
          getNavItemLabel(a, industry).localeCompare(getNavItemLabel(b, industry), 'es'));
        if (!items.length) return null;
        return (
          <details key={`${keyPrefix}-${group}`} className={styles.navGroup} open>
            <summary className={styles.navSummary}>
              <span>{getNavGroupLabel(group, industry)}</span>
              <CaretDown size={16} className={styles.navCaret} aria-hidden="true" />
            </summary>
            <div>{items.map((item) => {
              const Icon = item.icon;
              const href = industry === 'inmobiliaria' && item.href === '/expedientes' ? '/operaciones' : item.href;
              return <ActiveNavLink key={`${keyPrefix}-${href}`} href={href} label={getNavItemLabel(item, industry)}>
                <Icon size={16} weight="regular" />
              </ActiveNavLink>;
            })}</div>
          </details>
        );
      })}
    </nav>
  );
  const renderAccount = () => (
    <AccountMenu summary={<>
        <span className={styles.avatar} aria-hidden="true">{initials || 'AN'}</span>
        <span className={styles.accountText}><strong>{accountName}</strong>{roleLabel}</span>
        <CaretDown size={16} className={styles.navCaret} aria-hidden="true" />
      </>}>
        <Link href="/configuracion" className={styles.accountAction}><GearSix size={16} aria-hidden="true" />Ajustes de cuenta</Link>
        <form action={signOut}><button type="submit" className={styles.accountAction}><SignOut size={16} aria-hidden="true" />Cerrar sesión</button></form>
    </AccountMenu>
  );
  return <>
    <aside className={styles.sidebar} aria-label="Barra lateral">
      <Link href="/dashboard" className={styles.brand} aria-label={`${brand.name} · Inicio`}>
        <span className={styles.brandName} data-brand-provisional="true">{brand.shortName}</span>
        <span className={styles.brandNote}>Identidad provisional</span>
      </Link>
      <div className={styles.navScroll}>{renderNavigation('desktop')}</div>
      {renderAccount()}
    </aside>
    <MobileNavigation>
      <div className={styles.navScroll}>{renderNavigation('mobile')}</div>
      {renderAccount()}
    </MobileNavigation>
  </>;
}
