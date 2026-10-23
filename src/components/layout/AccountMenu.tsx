'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Shell.module.css';

export function AccountMenu({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (root.current?.open && !root.current.contains(event.target as Node)) root.current.open = false;
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  return (
    <details ref={root} className={styles.account} onKeyDown={(event) => {
      if (event.key === 'Escape' && root.current?.open) {
        event.preventDefault();
        root.current.open = false;
        root.current.querySelector('summary')?.focus();
      }
    }}>
      <summary className={styles.accountTrigger} aria-label="Abrir menú de cuenta">{summary}</summary>
      <div className={styles.accountMenu}>{children}</div>
    </details>
  );
}