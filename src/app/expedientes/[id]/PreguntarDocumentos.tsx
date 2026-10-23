'use client';

import { useState, type FormEvent } from 'react';
import { FileMagnifyingGlass, PaperPlaneTilt, Sparkle, CaretDown } from '@phosphor-icons/react';
import styles from './DocumentQuery.module.css';
import { preguntarADocumentosLegajo, type FuenteLegajo } from './ragLegajoActions';

import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';

function RespuestaConCitas({ texto }: { texto: string }) {
  const parrafos = texto.split('\n').filter((l) => l.trim().length > 0);
  return (
    <div className={styles.paragraphs}>
      {parrafos.map((p, pi) => (
        <p key={pi} className={styles.paragraph}>
          {p.split(/(\[[0-9,\s]+\])/g).map((parte, i) =>
            /^\[[0-9,\s]+\]$/.test(parte) ? (
              <sup
                key={i}
                className={styles.citation}
              >
                {parte.replace(/[[\]]/g, '')}
              </sup>
            ) : (
              <span key={i}>{parte}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

export function PreguntarDocumentos({
  caseId,
  puedeUsarIA,
  industry,
}: {
  caseId: string;
  puedeUsarIA: boolean;
  industry?: string;
}) {
  const terms = getIndustryTerms(normalizeIndustryType(industry));
  const [pregunta, setPregunta] = useState('');
  const [preguntaMostrada, setPreguntaMostrada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<FuenteLegajo[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!puedeUsarIA) return null;

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const q = pregunta.trim();
    if (!q || cargando) return;
    setPreguntaMostrada(q);
    setPregunta('');
    setCargando(true);
    setError(null);
    setRespuesta(null);
    setFuentes([]);
    try {
      const r = await preguntarADocumentosLegajo(caseId, q);
      if (r.ok) {
        setRespuesta(r.respuesta ?? '');
        setFuentes(r.fuentes ?? []);
      } else {
        setError(r.error ?? 'No se pudo responder.');
      }
    } catch {
      setError('Hubo un error de conexión. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <details className={styles.disclosure}>
      <summary className={styles.toggle}><span><FileMagnifyingGlass size={20} aria-hidden="true"/><span><strong>Preguntá a los documentos</strong><small>Consulta con fuentes · IA a demanda</small></span></span><CaretDown size={16} aria-hidden="true"/></summary>
      <div className={styles.body}>
        <p className={styles.scope}>Respuestas basadas en el contenido real de {terms.eseExpediente || (industry === 'inmobiliaria' ? 'esa operación' : industry === 'escribania' ? 'ese legajo' : 'ese expediente')}, con la fuente citada.</p>
        <form onSubmit={enviar} className={styles.form}>
          <label className={styles.label}>Tu consulta<input value={pregunta} onChange={(e)=>setPregunta(e.target.value)} placeholder="Ej: ¿Quién es el titular del inmueble? ¿Hay hipoteca?" data-testid="rag-input" className={styles.input}/></label>
          <button type="submit" data-testid="rag-submit" disabled={cargando || !pregunta.trim()} className={styles.send}><PaperPlaneTilt size={18} aria-hidden="true"/><span>Preguntar</span></button>
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {(preguntaMostrada || cargando || respuesta) && <div className={styles.result} aria-busy={cargando}>
          {preguntaMostrada && <div className={styles.user}><small>Vos</small><p>{preguntaMostrada}</p></div>}
          {cargando && <p className={styles.loading} role="status"><Sparkle size={16} aria-hidden="true"/>Leyendo los documentos</p>}
          {respuesta && <>
            <div className={styles.answer}><h4><Sparkle size={18} aria-hidden="true"/>Respuesta documental</h4><div data-testid="rag-response"><RespuestaConCitas texto={respuesta}/></div></div>
            {fuentes.length>0 && <section className={styles.sources} data-testid="rag-sources" aria-label="Fuentes de la respuesta"><h4>Fuentes</h4>{fuentes.map((f,i)=><details key={`${f.documentId}-${i}`} data-testid={`rag-source-${i}`} className={styles.source}>
              <summary><span className={styles.citation}>{i+1}</span><span>{f.fileName}</span><CaretDown size={16} aria-hidden="true"/></summary><p>{f.fragmento}</p>
            </details>)}</section>}
          </>}
        </div>}
      </div>
    </details>
  );
}
