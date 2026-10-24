'use client';

import { useFormStatus } from 'react-dom';
import { CaretDown, Robot, Warning } from '@phosphor-icons/react';
import styles from '@/components/approved/SummaryPriority.module.css';
import { pluralDocumentoAnalizado } from '@/lib/format/pluralize';
import { generarResumenExpediente } from '../actions';

type ResumenExpediente = {
  resumen_general: string; estado_actual: string;
  partes: string[]; puntos_clave: string[]; riesgos_alertas: string[]; proximas_acciones: string[];
};

function BotonGenerar({ tieneResumen }: { tieneResumen: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className={styles.action} aria-busy={pending}>
      {pending ? 'Generando…' : tieneResumen ? 'Actualizar resumen con IA' : 'Generar resumen con IA'}
    </button>
  );
}

function Bloque({ titulo, items, tono = 'slate' }: { titulo: string; items: string[]; tono?: 'slate' | 'amber' | 'emerald' }) {

  return (
    <div className={`${styles.detailBlock} ${styles[tono]}`}>
      <h3>{tono === 'amber' && <Warning size={16} aria-hidden="true" />}{titulo}</h3>
      <ul className={styles.items}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

export function CopilotoExpediente({
  caseId, resumen, generadoEl, documentosAnalizados, puedeUsarIA, terms,
}: {
  caseId: string; resumen: ResumenExpediente | null; generadoEl: string | null;
  documentosAnalizados: number; puedeUsarIA: boolean; terms: any;
}) {
  const generar = generarResumenExpediente.bind(null, caseId);

  return (
    <section className={styles.summary} data-summary-priority="saved">
      <div className={styles.summaryHeader}>
        <div>
          <h2><Robot size={18} aria-hidden="true" />{terms.copilotoTitulo}</h2>
          <p className={styles.subtitle}>{resumen ? 'Lectura guardada · Revisar antes de usar.' : terms.copilotoSubtitulo}</p>
        </div>
        {puedeUsarIA && (
          <form action={generar}><BotonGenerar tieneResumen={!!resumen} /></form>
        )}
      </div>

      {documentosAnalizados === 0 && !resumen && (
        <p className={styles.emptyWarning}>
          {terms.resumenVacio}
        </p>
      )}

      {!resumen && documentosAnalizados > 0 && (
        <p className={styles.empty}>
          Hay {pluralDocumentoAnalizado(documentosAnalizados)}. Tocá “Generar resumen con IA” para armar el panorama {terms.delExpediente}.
        </p>
      )}

      {resumen && (
        <div className={styles.saved}>
          <p>{resumen.resumen_general}</p>
          {resumen.estado_actual && (
            <p><span className={styles.stateLabel}>Estado: </span>{resumen.estado_actual}</p>
          )}
          <details className={styles.details}>
            <summary><span>Ver detalle del resumen</span><CaretDown size={16} aria-hidden="true" /></summary>
            <div className={styles.detailGrid}>
            {resumen.partes.length > 0 && <Bloque titulo={terms.partes} items={resumen.partes} />}
            {resumen.puntos_clave.length > 0 && <Bloque titulo="Puntos clave" items={resumen.puntos_clave} />}
            {resumen.riesgos_alertas.length > 0 && <Bloque titulo="Riesgos y alertas" items={resumen.riesgos_alertas} tono="amber" />}
            {resumen.proximas_acciones.length > 0 && <Bloque titulo="Próximas acciones" items={resumen.proximas_acciones} tono="emerald" />}
            </div>
          </details>
          {generadoEl && (
            <p className={styles.timestamp}>Generado el {new Date(generadoEl).toLocaleString('es-AR')} · Borrador orientativo, revisá antes de usar.</p>
          )}
        </div>
      )}
    </section>
  );
}
