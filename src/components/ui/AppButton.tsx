import Link from 'next/link';
import styles from './SharedControls.module.css';
import type { ComponentProps, ComponentPropsWithoutRef } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type StyleProps = { variant?: AppButtonVariant; appearance?: 'default' | 'navigation' };

function buttonClass(variant: AppButtonVariant, appearance: StyleProps['appearance'], className?: string) {
  return `group ${styles.button} ${styles[variant]}${appearance === 'navigation' ? ` ${styles.navigation}` : ''}${className ? ` ${className}` : ''}`;
}

export function AppButton({ variant = 'primary', appearance = 'default', className, type = 'button', ...props }: ComponentPropsWithoutRef<'button'> & StyleProps) {
  return <button type={type} className={buttonClass(variant, appearance, className)} {...props} />;
}

export function AppButtonLink({ variant = 'primary', appearance = 'default', className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClass(variant, appearance, className)} {...props} />;
}
