'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Buildings, SealCheck, CurrencyDollar, IdentificationCard, MapTrifold, Ruler, Scales } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import { SelectField } from '@/components/ui/SelectField';
import { updateProperty } from '../actions';
import type { PropertyRecord } from '@/types/property';
import { PropertyAiAssistant } from './PropertyAiAssistant';
import { createPropertyDraft, applyExtractionToDraft, propertyTypes, type PropertyDraft } from './propertyDraft';
import styles from './PropertyDetail.module.css';

const types = ['Seleccionar…', 'Casa', 'Departamento', 'Lote / Terreno', 'Local', 'Oficina', 'Cochera', 'Otro'];
const statuses = [['disponible', 'Disponible'], ['reservada', 'Reservada'], ['vendida', 'Vendida'], ['alquilada', 'Alquilada'], ['no_disponible', 'No disponible']];
interface Props { record: PropertyRecord; documents: { id: string; file_name: string }[]; useAi: boolean; onCancel: () => void }
function Actions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return <div className={styles.formActions}>
    <AppButton variant="secondary" disabled={pending} onClick={onCancel}>Cancelar</AppButton>
    <AppButton type="submit" disabled={pending} className={styles.primary}>{pending ? 'Guardando…' : 'Guardar cambios'}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton>
  </div>;
}
export function PropertyEditForm({ record, documents, useAi, onCancel }: Props) {
  const [initial] = useState(() => createPropertyDraft(record));
  const [draft, setDraft] = useState(initial);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = Object.keys(draft).some(key => draft[key as keyof PropertyDraft] !== initial[key as keyof PropertyDraft]);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const warnLink = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Tenés cambios sin guardar. ¿Descartarlos y salir de la ficha?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', warnLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', warnLink, true); };
  }, [dirty, saving]);
  function cancel() {
    if (!saving && (!dirty || window.confirm('Tenés cambios sin guardar. ¿Descartarlos y volver a la ficha?'))) onCancel();
  }
  function field(name: keyof PropertyDraft, label: string, wide = false, type = 'text', step?: string) {
    return <div className={wide ? styles.wideField : undefined} key={name}>
      <label htmlFor={`property-edit-${name}`}>{label}</label>
      {name === 'notes' ? <textarea id={`property-edit-${name}`} name={name} value={draft[name]} rows={3} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))} /> :
        <input id={`property-edit-${name}`} name={name} type={type} step={step} required={name === 'name'} value={draft[name]} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))} />}
    </div>;
  }
  const select = (name: 'property_type' | 'status' | 'currency', label: string, options: { value: string; label: string; detail?: string }[], icon: ReactNode) => <div>
    <p className={styles.fieldLabel}>{label}</p>
    <SelectField name={name} label={label} value={draft[name]} options={options.some(o => o.value === draft[name]) ? options : [...options, { value: draft[name], label: draft[name], detail: 'Valor registrado: revisá antes de cambiarlo' }]} placeholder="Seleccionar…" icon={icon} onChange={value => setDraft(d => ({ ...d, [name]: value }))} />
  </div>;
  return <>
    <div className={styles.intro}><div><h2 ref={heading} tabIndex={-1}>Editar propiedad</h2><p>Revisá los datos. Se guardan únicamente al confirmar Guardar cambios.</p></div><AppButton variant="secondary" disabled={saving} onClick={cancel}><ArrowLeft size={18} strokeWidth={1.7} aria-hidden="true" />Volver a la ficha</AppButton></div>
    <form className={`${styles.panel} ${styles.editForm}`} action={async data => {
      setSaving(true);
      try { await updateProperty(data); } finally { setSaving(false); }
    }}>
      <input type="hidden" name="property_id" value={record.id} />
      <fieldset disabled={saving}><legend><IdentificationCard size={20} weight="duotone" aria-hidden="true" />Identificación</legend><div className={styles.formGrid}>
        {field('name', 'Nombre de la propiedad *', true)}
        {select('property_type', 'Tipo', propertyTypes.map((value, i) => ({ value, label: types[i], detail: 'Tipo de inmueble registrado' })), <Buildings size={18} weight="duotone" />)}
        {select('status', 'Estado', statuses.map(([value, label]) => ({ value, label, detail: 'Estado de la propiedad' })), <SealCheck size={18} weight="duotone" />)}
      </div></fieldset>
      <fieldset disabled={saving}><legend><MapTrifold size={20} weight="duotone" aria-hidden="true" />Ubicación</legend><div className={styles.formGrid}>
        {field('address', 'Dirección', true)}{field('neighborhood', 'Barrio / Zona')}{field('subzone', 'Subzona (opcional)')}{field('city', 'Localidad / Ciudad', true)}{field('province', 'Provincia', true)}
      </div></fieldset>
      <fieldset disabled={saving}><legend><Ruler size={20} weight="duotone" aria-hidden="true" />Características y precio</legend><div className={styles.featureGrid}>
        {field('surface_total_m2', 'Superficie total (m²)', false, 'number', '0.01')}{field('surface_covered_m2', 'Superficie cubierta (m²)', false, 'number', '0.01')}{field('rooms', 'Ambientes', false, 'number')}
        {select('currency', 'Moneda', [{ value: 'USD', label: 'USD', detail: 'Dólares' }, { value: 'ARS', label: 'ARS', detail: 'Pesos' }], <CurrencyDollar size={18} weight="duotone" />)}{field('price', 'Precio registrado', false, 'number', '0.01')}
      </div></fieldset>
      <fieldset disabled={saving}><legend><Scales size={20} weight="duotone" aria-hidden="true" />Datos legales y observaciones</legend><div className={styles.formGrid}>
        {field('matricula', 'Matrícula / Catastro', true)}{field('owners', 'Titular(es)', true)}{field('gravamenes', 'Gravámenes / inhibiciones', true)}{field('notes', 'Observaciones', true)}
      </div></fieldset>
      <Actions onCancel={cancel} />
    </form>
    {notice && <p role="status" className={styles.note}>{notice}</p>}
    {useAi && <PropertyAiAssistant propertyId={record.id} documents={documents} disabled={saving} onApply={extraction => {
      const result = applyExtractionToDraft(draft, extraction);
      setDraft(result.draft);
      setNotice(`Sugerencias aplicadas al borrador. Revisá y guardá para confirmar.${result.skipped.length ? ` Tipo «${result.skipped.join(', ')}» no aplicado: seleccioná el tipo correspondiente; no se convirtió automáticamente.` : ''}`);
      heading.current?.focus();
    }} />}
    <p className={styles.note}>Los campos ausentes en el documento no borran tus datos. Cancelar descarta el borrador; cambiar de área conserva los borradores comerciales. El guardado de publicación es independiente.</p>
  </>;
}
