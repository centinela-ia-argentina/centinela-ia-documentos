'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
      className={`group relative flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#85E4D4] ${
        isActive
          ? 'bg-[#C8FF62]/10 text-white'
          : 'text-[#9BB0A9] hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      {isActive ? (
        <span
          className="absolute -left-0.5 h-[18px] w-[3px] rounded-full bg-[#C8FF62]"
          aria-hidden="true"
        />
      ) : null}
      <span
        className={isActive ? 'text-[#C8FF62]' : 'text-[#9BB0A9]'}
        aria-hidden="true"
      >
        {children}
      </span>
      <span>{label}</span>
    </Link>
  );
}