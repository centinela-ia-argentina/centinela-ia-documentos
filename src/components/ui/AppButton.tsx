import Link from 'next/link';
import type { ComponentProps, ComponentPropsWithoutRef } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type StyleProps = { variant?: AppButtonVariant; appearance?: 'default' | 'navigation' };

const variants: Record<AppButtonVariant, string> = {
  primary: 'group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/70 bg-[#F3F8F5] px-2.5 pl-5 font-ui text-xs font-bold text-[#071110] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(200,255,98,0.22),0_0_20px_rgba(200,255,98,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]',
  secondary: 'group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/20 bg-white/[0.035] px-2.5 pr-4 font-ui text-xs font-bold text-[#C0CEC9] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-white/35 hover:bg-white/[0.065] hover:text-white disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]',
  ghost: 'group inline-flex min-h-12 items-center justify-center gap-3 rounded-md px-4 font-ui text-xs font-bold text-[#B8C6C1] hover:bg-white/[0.045] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] disabled:pointer-events-none disabled:opacity-25',
  destructive: 'group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-red-300/20 bg-red-300/[0.045] px-4 font-ui text-xs font-bold text-red-200 hover:bg-red-300/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:pointer-events-none disabled:opacity-25',
};
const navigationSecondary = 'group inline-flex min-h-12 w-fit items-center gap-3 rounded-md border border-white/20 bg-white/[0.045] px-2.5 pr-4 font-ui text-xs font-bold text-[#D5E0DC] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-white/35 hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]';

function buttonClass(variant: AppButtonVariant, appearance: StyleProps['appearance'], className?: string) {
  return `${variant === 'secondary' && appearance === 'navigation' ? navigationSecondary : variants[variant]}${className ? ` ${className}` : ''}`;
}

export function AppButton({ variant = 'primary', appearance = 'default', className, type = 'button', ...props }: ComponentPropsWithoutRef<'button'> & StyleProps) {
  return <button type={type} className={buttonClass(variant, appearance, className)} {...props} />;
}

export function AppButtonLink({ variant = 'primary', appearance = 'default', className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClass(variant, appearance, className)} {...props} />;
}
