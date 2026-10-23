import styles from './SharedControls.module.css';
import type { ComponentPropsWithoutRef, ElementType } from 'react';

export type SurfaceFamily = 'panel' | 'secondary' | 'row' | 'interactive' | 'callout';
const families: Record<SurfaceFamily, string> = {
  panel: styles.panel,
  secondary: styles.secondarySurface,
  row: styles.row,
  interactive: styles.interactive,
  callout: styles.callout,
};
type SurfaceProps<T extends ElementType> = { as?: T; family?: SurfaceFamily; className?: string } & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export function Surface<T extends ElementType = 'div'>({ as, family = 'panel', className, ...props }: SurfaceProps<T>) {
  const Component = as ?? 'div';
  return <Component className={`${families[family]}${className ? ` ${className}` : ''}`} {...props} />;
}
