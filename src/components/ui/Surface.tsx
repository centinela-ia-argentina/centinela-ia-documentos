import type { ComponentPropsWithoutRef, ElementType } from 'react';

export type SurfaceFamily = 'panel' | 'secondary' | 'row' | 'interactive' | 'callout';
const families: Record<SurfaceFamily, string> = {
  panel: 'rounded-xl border border-white/[0.09] bg-[#091411] shadow-[0_24px_70px_rgba(0,0,0,0.2)]',
  secondary: 'border-white/[0.07] bg-[#07110F]/60',
  row: 'border-b border-white/[0.07]',
  interactive: 'rounded-lg border border-white/[0.11] bg-[#07110F]',
  callout: 'rounded-lg border border-[#85E4D4]/15 bg-[#85E4D4]/[0.04]',
};
type SurfaceProps<T extends ElementType> = { as?: T; family?: SurfaceFamily; className?: string } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export function Surface<T extends ElementType = 'div'>({ as, family = 'panel', className, ...props }: SurfaceProps<T>) {
  const Component = as ?? 'div';
  return <Component className={`${families[family]}${className ? ` ${className}` : ''}`} {...props} />;
}
