'use client';

import { useState, useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { Sparkle, FileText, CheckCircle } from '@phosphor-icons/react';
import { AppButton, AppButtonLink } from '@/components/ui/AppButton';
import { extraerDatosPropiedadIA } from '../actions';
import type { PropertyExtraction } from '@/lib/ai/extraerPropiedad';
import styles from './PropertyDetail.module.css';

interface Props {
  propertyId: string; documents: { id: string; file_name: string }[];
  onApply: (data: PropertyExtraction) => void; disabled?: boolean;
}
export function PropertyAiAssistant({ propertyId, documents, onApply, disabled = false }: Props) {
  const [selectedDocId, setSelectedDocId] = useState(documents[0]?.id || '');
  const [isPending, startTransition] = useTransition();
  const [extractedData, setExtractedData] = useState<PropertyExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const busy = disabled || isPending;
  const hasData = extractedData && Object.values(extractedData).some(value => value != null && value !== '');
  function extract() {
    if (!selectedDocId || busy) return;
    setError(null); setExtractedData(null);
    startTransition(async () => {
      try {
        const result = await extraerDatosPropiedadIA(propertyId, selectedDocId);
        if (result.ok && result.data) setExtractedData(result.data);
        else setError(result.error || 'No se pudo leer el documento.');
      } catch { setError('No se pudo analizar el documento. Intentá nuevamente.'); }
    });
  }
  return <section className={`${styles.panel} ${styles.documentHelp}`}>
    <div className={styles.sectionHead}><span className={styles.icon}><Sparkle size={25} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>AYUDA A PEDIDO</span><h3>Ayuda con documentos</h3></div></div>
    <p>Leé un documento, revisá las sugerencias y aplicalas al borrador. La IA no guarda cambios en la ficha.</p>
    {!documents.length ? <><p>No hay documentos disponibles. Subí un título, boleto o contrato a la Bóveda.</p><AppButtonLink href="/documentos/subir">Subir documento<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButtonLink></> : <>
      <AppButton variant="secondary" aria-expanded={open} aria-controls="property-document-help" disabled={busy} onClick={() => setOpen(value => !value)}>{open ? 'Ocultar ayuda documental' : 'Revisar un documento'}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton>
      <div id="property-document-help" hidden={!open}>
        <p className={styles.note}>Documentos de la organización: verificá que el seleccionado corresponda a esta propiedad.</p>
        {!extractedData && <div className={styles.documentControls}><label htmlFor="property-document">Documento de la Bóveda</label><select id="property-document" value={selectedDocId} disabled={busy} onChange={e => setSelectedDocId(e.target.value)}>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.file_name}</option>)}</select><AppButton className={styles.primary} disabled={busy || !selectedDocId} onClick={extract}><FileText size={18} weight="duotone" aria-hidden="true" />{isPending ? 'Leyendo…' : 'Leer con IA'}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {extractedData && <>
          <div className={styles.intro}><h4><CheckCircle size={20} weight="duotone" aria-hidden="true" />Sugerencias del documento</h4><AppButton variant="secondary" disabled={busy} onClick={() => setExtractedData(null)}>Descartar sugerencias</AppButton></div>
          {!hasData ? <p>No se encontraron datos útiles. Tu borrador no cambió.</p> : <><dl className={styles.suggestions}>{Object.entries(extractedData).filter(([, value]) => value != null && value !== '').map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><AppButton className={styles.primary} disabled={busy} onClick={() => { onApply(extractedData); setExtractedData(null); }}>Aplicar al borrador<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton></>}
        </>}
      </div>
    </>}
  </section>;
}
