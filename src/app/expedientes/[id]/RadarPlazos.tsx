'use client';

import { useState } from 'react';
import { CalendarPlus, Check, CircleNotch, TrafficSignal } from '@phosphor-icons/react';
import styles from '@/components/approved/SummaryPriority.module.css';
import { guardarPlazoDetectado } from '@/app/agenda/actions';
import { formatIsoToAr } from '@/lib/plazos/fechasCanonicas';
import {
  deduplicarPlazosRadar,
  NIVELES_RADAR,
  type PlazoRadar,
} from '@/lib/plazos/radarDeduplicacion';
import type { ItemCronologia } from './CronologiaExpediente';
import type { IndustryType } from '@/lib/industries/documentTypes';

function textoDias(n: number): string {
  if (n < 0) return `hace ${Math.abs(n)} día${Math.abs(n) === 1 ? '' : 's'}`;
  if (n === 0) return 'vence hoy';
  if (n === 1) return 'vence mañana';
  return `a ${n} días`;
}

function getDetalleAgenda(p: PlazoRadar, industry?: IndustryType): string {
  const etiquetaPrefijo =
    industry === 'inmobiliaria'
      ? 'Vencimiento de la operación'
      : industry === 'escribania'
        ? 'Vigencia del legajo'
        : 'Plazo del expediente';

  return `${etiquetaPrefijo} · ${p.item.etiquetaOrigen}`;
}

export function RadarPlazos({
  items,
  caseId,
  titulo = 'Radar de plazos',
  subtitulo = 'Plazos vencidos y próximos (hasta 30 días), ordenados por urgencia.',
  industry,
}: {
  items: ItemCronologia[];
  caseId: string;
  titulo?: string;
  subtitulo?: string;
  industry?: IndustryType;
}) {
  const [estados, setEstados] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'existing' | 'error'>>({});

  const plazos = deduplicarPlazosRadar(items);

  async function cargar(key: string, p: PlazoRadar) {
    setEstados((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const res = await guardarPlazoDetectado({
        titulo: p.item.titulo,
        fecha: p.item.fecha,
        detalle: getDetalleAgenda(p, industry),
        caseId,
      });
      setEstados((prev) => ({ ...prev, [key]: res?.ok ? (res.existing ? 'existing' : 'ok') : 'error' }));
    } catch {
      setEstados((prev) => ({ ...prev, [key]: 'error' }));
    }
  }

  if (plazos.length === 0) {
    return (
      <section data-testid="radar-plazos" className={styles.radar} data-summary-priority="dates">
        <h2><TrafficSignal size={18} aria-hidden="true" />{titulo}</h2>
        <p className={styles.empty}>
          No hay plazos vencidos ni próximos (30 días). Aparecerán aquí los plazos que detecte la IA o que cargues manualmente.
        </p>
      </section>
    );
  }

  const conteo = NIVELES_RADAR
    .map((nv) => ({ nivel: nv, n: plazos.filter((p) => p.nivel.id === nv.id).length }))
    .filter((c) => c.n > 0);

  return (
    <section data-testid="radar-plazos" className={styles.radar} data-summary-priority="dates">
      <div className={styles.radarHeader}>
        <h2><TrafficSignal size={18} aria-hidden="true" />{titulo}</h2>
        {conteo.map((c) => (
          <span key={c.nivel.id} className={`${styles.chip} ${styles[c.nivel.id]}`}>
            <span className={styles.dot} aria-hidden="true" />{c.n} {c.nivel.label}
          </span>
        ))}
      </div>
      <p className={styles.subtitle}>
        {subtitulo}
      </p>

      <ul className={styles.radarList}>
        {plazos.map((p, i) => {
          const key = `${p.item.fecha}-${i}`;
          const estado = estados[key] ?? 'idle';
          return (
            <li key={key} className={`${styles.radarItem} ${styles[p.nivel.id]}`}>
              <span className={styles.itemDot} aria-hidden="true" />
              <div className={styles.radarContent}>
                <div className={styles.origin}>
                  <span className={styles.chip}>
                    {textoDias(p.dias)}
                  </span>
                  <span className={styles.source}>{p.item.etiquetaOrigen}</span>
                </div>
                <p className={styles.deadlineTitle}>
                  {p.item.titulo.includes(formatIsoToAr(p.item.fecha))
                    ? p.item.titulo
                    : `${p.item.titulo} — ${formatIsoToAr(p.item.fecha)}`}
                </p>
              </div>
              {estado === 'ok' ? (
                <span className={styles.confirmed} role="status">
                  <Check size={16} aria-hidden="true" /> En agenda
                </span>
              ) : estado === 'existing' ? (
                <span className={styles.existing} role="status">
                  <Check size={16} aria-hidden="true" /> Ya en agenda
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => cargar(key, p)}
                  disabled={estado === 'loading'}
                  className={styles.action} aria-busy={estado === 'loading'}
                >
                  {estado === 'loading' ? <CircleNotch size={16} className={styles.spinner} aria-hidden="true" /> : <CalendarPlus size={16} aria-hidden="true" />}
                  {estado === 'loading' ? 'Cargando…' : estado === 'error' ? 'Reintentar' : 'Cargar a agenda'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
