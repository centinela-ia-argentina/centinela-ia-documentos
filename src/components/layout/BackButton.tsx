'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from '@phosphor-icons/react';
import styles from './Shell.module.css';

const HOME_ROUTES = ['/dashboard'];

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (HOME_ROUTES.includes(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver atrás"
      className={styles.iconAction}
    >
      <ArrowLeft size={17} weight="regular" />
      <span className={styles.actionLabel}>Volver</span>
    </button>
  );
}
