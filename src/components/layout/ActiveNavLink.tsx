'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Shell.module.css';

interface ActiveNavLinkProps {
  href: string;
  label: string;
  children: React.ReactNode;
}

export function ActiveNavLink({
  href,
  label,
  children,
}: ActiveNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={styles.navItem}
    >
      <span aria-hidden="true">{children}</span>
      <span>{label}</span>
    </Link>
  );
}