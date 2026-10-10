import type { ComponentPropsWithoutRef } from 'react';

export function Eyebrow({ variant = 'editorial', className, ...props }: ComponentPropsWithoutRef<'p'> & { variant?: 'editorial' | 'step' }) {
  const base = variant === 'step' ? 'font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#85E4D4]' : 'font-ui text-xs font-semibold text-[#85E4D4]';
  return <p className={`${base}${className ? ` ${className}` : ''}`} {...props} />;
}
export function PageTitle({ className, ...props }: ComponentPropsWithoutRef<'h1'>) {
  return <h1 className={`font-display text-[clamp(2.35rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.06em] text-[#F3F8F5]${className ? ` ${className}` : ''}`} {...props} />;
}
export function SectionTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={`font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]${className ? ` ${className}` : ''}`} {...props} />;
}
export function SupportingCopy({ variant = 'section', className, ...props }: ComponentPropsWithoutRef<'p'> & { variant?: 'hero' | 'section' }) {
  const base = variant === 'hero' ? 'max-w-2xl font-ui text-sm font-medium leading-6 text-[#B8C6C1] sm:text-[16px]' : 'max-w-xl font-ui text-sm leading-6 text-[#7F938D]';
  return <p className={`${base}${className ? ` ${className}` : ''}`} {...props} />;
}
