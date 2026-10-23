import type { ComponentPropsWithoutRef } from 'react';
import styles from './SharedControls.module.css';

export function Eyebrow({ variant = 'editorial', className, ...props }: ComponentPropsWithoutRef<'p'> & { variant?: 'editorial' | 'step' }) {
  return <p className={`font-ui ${styles.eyebrow}${variant === 'step' ? ` ${styles.stepEyebrow}` : ''}${className ? ` ${className}` : ''}`} {...props} />;
}
export function PageTitle({ className, ...props }: ComponentPropsWithoutRef<'h1'>) {
  return <h1 className={`font-display ${styles.pageTitle}${className ? ` ${className}` : ''}`} {...props} />;
}
export function SectionTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={`font-display ${styles.sectionTitle}${className ? ` ${className}` : ''}`} {...props} />;
}
export function SupportingCopy({ variant = 'section', className, ...props }: ComponentPropsWithoutRef<'p'> & { variant?: 'hero' | 'section' }) {
  return <p className={`font-ui ${styles.copy}${variant === 'hero' ? ` ${styles.heroCopy}` : ''}${className ? ` ${className}` : ''}`} {...props} />;
}
