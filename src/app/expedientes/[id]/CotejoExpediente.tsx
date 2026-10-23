'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import styles from './IndustryTools.module.css';
import { useFormStatus } from 'react-dom';
import { cotejarExpediente } from '../actions';

type CotejoNotarial = {
  veredicto: string;
  coincidencias: string[];
  discrepancias: string[];
  faltantes: string[];
  alertas_vigencia: string[];
};

function BotonCotejar({ tieneCotejo }: { tieneCotejo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.action}
    >
      {pending ? 'Cotejando…' : tieneCotejo ? 'Volver a cotejar' : 'Cotejar documentos con IA'}
    </button>
  );
}

function Bloque({
  titulo,
  items,
  tono = 'slate',
}: {
  titulo: string;
  items: string[];
  tono?: 'slate' | 'amber' | 'rose' | 'emerald';
}) {
  const tonos: Record<string, string> = {
    slate: styles.output,
    amber: styles.notice,
    rose: styles.alert,
    emerald: styles.output,
  };
  if (items.length === 0) return null;
  return (
    <div className={tonos[tono]}>
      <p className={styles.title}>{titulo}</p>
      <ul role="list" className={`${styles.list} ${styles.inlineBulletList}`}>
        {items.map((it, i) => (
          <li key={i} className={styles.description}>• {it}</li>
        ))}
      </ul>
    </div>
  );
}

import { sanitizeTextoInmobiliario } from '@/lib/format/sanitizerInmobiliaria';

export function CotejoExpediente({
  caseId,
  industry,
  cotejo,
  generadoEl,
  documentosAnalizados,
  puedeUsarIA,
}: {
  caseId: string;
  industry?: string;
  cotejo: CotejoNotarial | null;
  generadoEl: string | null;
  documentosAnalizados: number;
  puedeUsarIA: boolean;
}) {
  const cotejar = cotejarExpediente.bind(null, caseId);
  const esLegal = industry === 'legal';
  const esInmo = industry === 'inmobiliaria';

  const terminoContenedor = esLegal ? 'este expediente' : esInmo ? 'esta operación' : 'este legajo';

  const titulo = esLegal
    ? 'Cotejo del expediente con IA'
    : esInmo
    ? 'Cotejo inmobiliario con IA'
    : 'Cotejo notarial con IA';
  const descripcion = esLegal
    ? 'Cruza los escritos del expediente (demanda, contestación y demás presentaciones) y marca hechos reconocidos, puntos controvertidos, prueba pendiente y alertas procesales.'
    : esInmo
    ? 'Cruza los documentos de la operación (reserva, boleto, informe de dominio) y marca coincidencias, discrepancias, faltantes y vigencias.'
    : 'Cruza los documentos del legajo (boleto, título, certificados) y marca coincidencias, discrepancias, faltantes y vigencias.';
  
  const rotuloCoincidencias = esLegal ? 'Hechos reconocidos' : 'Coincidencias';
  const rotuloDiscrepancias = esLegal ? 'Puntos controvertidos' : 'Discrepancias';
  const rotuloFaltantes = esLegal ? 'Prueba pendiente' : 'Faltantes';
  const rotuloVigencias = esLegal ? 'Alertas procesales' : 'Vigencias';
  const pieAccion = esLegal ? 'revisá antes de presentar' : esInmo ? 'revisá antes de firmar' : 'revisá antes de otorgar';

  const veredicto = esInmo && cotejo?.veredicto ? sanitizeTextoInmobiliario(cotejo.veredicto) : cotejo?.veredicto;
  const coincidencias = esInmo && cotejo?.coincidencias ? cotejo.coincidencias.map(sanitizeTextoInmobiliario) : cotejo?.coincidencias ?? [];
  const discrepancias = esInmo && cotejo?.discrepancias ? cotejo.discrepancias.map(sanitizeTextoInmobiliario) : cotejo?.discrepancias ?? [];
  const faltantes = esInmo && cotejo?.faltantes ? cotejo.faltantes.map(sanitizeTextoInmobiliario) : cotejo?.faltantes ?? [];
  const alertasVigencia = esInmo && cotejo?.alertas_vigencia ? cotejo.alertas_vigencia.map(sanitizeTextoInmobiliario) : cotejo?.alertas_vigencia ?? [];

  return (
    <div data-testid="cotejo-expediente" className={styles.tool}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}><MagnifyingGlass size={18} aria-hidden="true" /> {titulo}</h2>
          <p className={styles.description}>
            {descripcion}
          </p>
        </div>
        {puedeUsarIA && (
          <form action={cotejar}>
            <BotonCotejar tieneCotejo={!!cotejo} />
          </form>
        )}
      </div>

      {documentosAnalizados < 1 && !cotejo && (
        <p className={styles.description}>
          Necesitás al menos 1 documento analizado en {terminoContenedor} para poder cotejarlo.
        </p>
      )}

      {documentosAnalizados >= 1 && !cotejo && (
        <p className={styles.description}>
          Hay {documentosAnalizados} documento{documentosAnalizados > 1 ? 's' : ''} analizado{documentosAnalizados > 1 ? 's' : ''}. Tocá “Cotejar documentos con IA” para cruzarlos.
        </p>
      )}

      {cotejo && (
        <div className={styles.result}>
          <p className={styles.description}>{veredicto}</p>
          <Bloque titulo={rotuloCoincidencias} items={coincidencias} tono="emerald" />
          <div data-testid="cotejo-discrepancias">
            <Bloque titulo={rotuloDiscrepancias} items={discrepancias} tono="rose" />
          </div>
          <Bloque titulo={rotuloFaltantes} items={faltantes} tono="slate" />
          <div data-testid="cotejo-vigencias">
            <Bloque titulo={rotuloVigencias} items={alertasVigencia} tono="amber" />
          </div>
          {generadoEl && (
            <p className={styles.footnote}>
              Cotejo generado el {new Date(generadoEl).toLocaleString('es-AR')} · Borrador orientativo, {pieAccion}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
