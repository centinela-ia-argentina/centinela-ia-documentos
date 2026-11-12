'use client';

import { useState } from 'react';
import styles from './Shell.module.css';

/**
 * Logo rectangular de la organización en el bloque de cuenta.
 * Contenedor estable con object-contain; ante ausencia o fallo de carga
 * se muestran iniciales (incluye fallos detectados después de la hidratación).
 */
export function OrganizationLogo({ logoUrl, initials }: { logoUrl: string | null; initials: string }) {
  const [fallado, setFallado] = useState(false);

  if (!logoUrl || fallado) {
    return <span className={styles.avatar} aria-hidden="true">{initials || 'AN'}</span>;
  }

  return (
    <span className={styles.orgLogoBox} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className={styles.orgLogoImage}
        onError={() => setFallado(true)}
      />
    </span>
  );
}
