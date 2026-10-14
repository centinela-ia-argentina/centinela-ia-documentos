'use client';

import { ExternalLink, ArrowRight } from 'lucide-react';
import { GlobeHemisphereWest, TextT, TextAlignLeft, Hash, ClipboardText, CheckCircle } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import { SelectField } from '@/components/ui/SelectField';
import styles from './PropertyDetail.module.css';
import { useState } from 'react';
import type { PropertyRecord } from '@/types/property';
import { getPropertyTypeLabel } from '@/lib/properties/labels';

interface PublicacionAsistidaPanelProps {
  property: PropertyRecord;
  canManage: boolean;
}

export function PublicacionAsistidaPanel({ property, canManage }: PublicacionAsistidaPanelProps) {
  const [status, setStatus] = useState(property.publication_status ?? 'no_publicada');
  const [notes, setNotes] = useState(property.publication_notes ?? '');
  const [urlMercadoLibre, setUrlMercadoLibre] = useState(property.publication_url_mercadolibre ?? '');
  const [urlZonaprop, setUrlZonaprop] = useState(property.publication_url_zonaprop ?? '');
  const [urlArgenprop, setUrlArgenprop] = useState(property.publication_url_argenprop ?? '');
  const [urlOther, setUrlOther] = useState(property.publication_url_other ?? '');

  const [copied, setCopied] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/propiedades/${property.id}/publicacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_status: status,
          publication_notes: notes,
          publication_url_mercadolibre: urlMercadoLibre,
          publication_url_zonaprop: urlZonaprop,
          publication_url_argenprop: urlArgenprop,
          publication_url_other: urlOther
        })
      });

      const res = await response.json();

      if (response.ok && res.publication) {
        setStatus(res.publication.publication_status ?? 'no_publicada');
        setNotes(res.publication.publication_notes ?? '');
        setUrlMercadoLibre(res.publication.publication_url_mercadolibre ?? '');
        setUrlZonaprop(res.publication.publication_url_zonaprop ?? '');
        setUrlArgenprop(res.publication.publication_url_argenprop ?? '');
        setUrlOther(res.publication.publication_url_other ?? '');

        setFeedback({ type: 'success', text: 'Publicación actualizada' });
        // Hide success message after 3 seconds
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', text: res.error || 'Error al guardar' });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: 'Error inesperado al guardar' });
    } finally {
      setIsSaving(false);
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const titleText = property.name;
  const descText = `📍 Ubicación: ${[property.address, property.neighborhood, property.city].filter(Boolean).join(', ')}
🏠 Tipo: ${getPropertyTypeLabel(property.property_type)}
📐 Superficie: ${property.surface_total_m2 ? `${property.surface_total_m2} m² totales` : ''} ${property.surface_covered_m2 ? `(${property.surface_covered_m2} m² cubiertos)` : ''}
🚪 Ambientes: ${property.rooms || '-'}
💰 Valor: ${property.currency === 'USD' ? 'u$s' : '$'} ${property.price?.toLocaleString('es-AR') || 'Consultar'}

Para más información, contactanos.`;
  const hashtagsText = `#Inmobiliaria #RealEstate #${getPropertyTypeLabel(property.property_type)?.replace(/\s+/g, '')} ${property.neighborhood ? `#${property.neighborhood.replace(/\s+/g, '')}` : ''} #Oportunidad`;

  const portals = [
    { key: 'mercadolibre', label: 'MercadoLibre', value: urlMercadoLibre, set: setUrlMercadoLibre },
    { key: 'zonaprop', label: 'Zonaprop', value: urlZonaprop, set: setUrlZonaprop },
    { key: 'argenprop', label: 'Argenprop', value: urlArgenprop, set: setUrlArgenprop },
    { key: 'other', label: 'Otro / Redes', value: urlOther, set: setUrlOther },
  ];
  const options = [
    { value: 'no_publicada', label: 'No publicada', detail: 'Sin publicación registrada' },
    { value: 'en_preparacion', label: 'En preparación', detail: 'Material en preparación' },
    { value: 'publicada', label: 'Publicada', detail: 'Publicación manual registrada' },
    { value: 'pausada', label: 'Pausada / Finalizada', detail: 'Publicación detenida' },
  ];
  return <>
    <section className={styles.quickSection}><h3>Textos rápidos</h3><p>Atajos de copia para preparar tu comunicación.</p><div className={styles.quickGrid}>
      {[{ id: 'title', label: 'Título', detail: 'Una presentación breve', text: titleText, icon: TextT }, { id: 'desc', label: 'Descripción básica', detail: 'Datos principales del inmueble', text: descText, icon: TextAlignLeft }, { id: 'tags', label: 'Hashtags', detail: 'Etiquetas para tu publicación', text: hashtagsText, icon: Hash }].map(({ id, label, detail, text, icon: Icon }) => <button type="button" key={id} className={styles.quickCard} onClick={() => handleCopy(id, text)}><span className={styles.icon}><Icon size={24} weight="duotone" aria-hidden="true" /></span><span><strong>{copied === id ? 'Copiado' : label}</strong><small>{detail}</small></span>{copied === id ? <CheckCircle size={20} weight="duotone" aria-hidden="true" /> : <ClipboardText size={20} weight="duotone" aria-hidden="true" />}</button>)}
    </div></section>
    <section className={styles.panel}>
      <div className={styles.sectionHead}><span className={styles.icon}><GlobeHemisphereWest size={27} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>SEGUIMIENTO MANUAL</span><h3>Registro de publicación</h3></div></div>
      <p>Registrá los enlaces donde publicaste manualmente. El sistema no publica automáticamente en los portales.</p>
      <form onSubmit={handleSubmit} className={styles.publicationForm}>
        <input type="hidden" name="property_id" value={property.id} />
        <fieldset disabled={!canManage || isSaving}><legend>Estado y notas</legend><div className={styles.publicationGrid}>
          <div><p className={styles.fieldLabel}>Estado de publicación</p><SelectField name="publication_status" label="Estado de publicación" value={status} onChange={setStatus} options={options.some(option => option.value === status) ? options : [...options, { value: status, label: status, detail: 'Valor registrado' }]} placeholder="Seleccionar…" icon={<GlobeHemisphereWest size={18} weight="duotone" />} /></div>
          <div><label htmlFor="property-publication-notes">Notas de publicación</label><input id="property-publication-notes" name="publication_notes" type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Falta renovar cartel" /></div>
        </div></fieldset>
        <fieldset disabled={!canManage || isSaving}><legend>Enlaces de publicación</legend><div className={styles.publicationGrid}>{portals.map(portal => <div key={portal.key}><label htmlFor={`property-portal-${portal.key}`}>{portal.label}</label><div className={styles.portalInput}><input id={`property-portal-${portal.key}`} name={`publication_url_${portal.key}`} type="url" value={portal.value} onChange={e => portal.set(e.target.value)} placeholder="https://…" /></div></div>)}</div></fieldset>
        <div className={styles.portalLinks}>{portals.filter(portal => portal.value).map(portal => <a key={portal.key} href={portal.value} target="_blank" rel="noopener noreferrer">Abrir {portal.label}<ExternalLink size={16} aria-hidden="true" /></a>)}</div>
        {feedback && <p role={feedback.type === 'error' ? 'alert' : 'status'} className={feedback.type === 'error' ? styles.error : styles.note}>{feedback.text}</p>}
        {canManage ? <div className={styles.formActions}><AppButton className={styles.primary} type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar enlaces'}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton></div> : <p className={styles.note}>Solo lectura: no podés modificar el registro de publicación.</p>}
      </form>
    </section>
  </>;
}
