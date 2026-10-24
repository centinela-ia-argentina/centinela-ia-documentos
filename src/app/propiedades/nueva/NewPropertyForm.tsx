'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Buildings, SealCheck, CurrencyDollar, IdentificationCard, MapTrifold, Ruler, Scales } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import { SelectField } from '@/components/ui/SelectField';
import { createNewProperty } from './creationAction';
import { creationDefaults, type CreationDraft, type CreationField } from './propertyCreation';
import styles from './NewProperty.module.css';

const propertyTypes = [['', 'Seleccionar…'], ['casa', 'Casa'], ['departamento', 'Departamento'], ['lote/terreno', 'Lote / Terreno'], ['local', 'Local'], ['oficina', 'Oficina'], ['cochera', 'Cochera'], ['otro', 'Otro']];
const statuses = [['disponible', 'Disponible'], ['reservada', 'Reservada'], ['vendida', 'Vendida'], ['alquilada', 'Alquilada'], ['no_disponible', 'No disponible']];

export function NewPropertyForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<CreationDraft>({ ...creationDefaults });
  const [result, formAction, pending] = useActionState(createNewProperty, { error: null, field: null });
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = (Object.keys(creationDefaults) as CreationField[]).some(key => draft[key] !== creationDefaults[key]);
  useEffect(() => { if (result.error) errorRef.current?.focus(); }, [result]);
  useEffect(() => {
    if (!dirty || pending) return;
    function warnUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ''; }
    function warnLink(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Tenés datos sin guardar. ¿Descartar el borrador y salir?')) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener('beforeunload', warnUnload);
    document.addEventListener('click', warnLink, true);
    return () => { window.removeEventListener('beforeunload', warnUnload); document.removeEventListener('click', warnLink, true); };
  }, [dirty, pending]);
  function cancel() {
    if (!pending && (!dirty || window.confirm('Tenés datos sin guardar. ¿Descartar el borrador y volver al listado?'))) router.push('/propiedades');
  }
  function field(name: CreationField, label: string, wide = false, type = 'text', placeholder?: string, step?: string) {
    const props = {
      id: `property-new-${name}`, name, value: draft[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(d => ({ ...d, [name]: event.target.value })),
      'aria-invalid': result.field === name || undefined,
      'aria-describedby': result.field === name ? 'property-new-error' : undefined,
    };
    return <div className={wide ? styles.wideField : undefined}>
      <label htmlFor={props.id}>{label}</label>
      {name === 'notes' ? <textarea {...props} placeholder={placeholder} rows={3} /> : <input {...props} type={type} placeholder={placeholder} step={step} required={name === 'name'} />}
    </div>;
  }
  function select(name: 'property_type' | 'status' | 'currency', label: string, options: { value: string; label: string; detail: string }[], icon: ReactNode) {
    return <div><p className={styles.fieldLabel}>{label}</p><SelectField name={name} label={label} value={draft[name]} options={options} placeholder="Seleccionar…" icon={icon} onChange={value => setDraft(d => ({ ...d, [name]: value }))} /></div>;
  }
  return <div className={styles.page}>
    <AppButton variant="ghost" className={styles.back} disabled={pending} onClick={cancel}><ArrowLeft size={18} strokeWidth={1.7} aria-hidden="true" />Volver a propiedades</AppButton>
    <header className={styles.header}><p className={styles.eyebrow}><Buildings size={20} weight="duotone" aria-hidden="true" />Registro de una propiedad</p><h1>Nueva propiedad</h1><p>Cargá los datos que tengas. Podrás completar o actualizar la ficha más adelante.</p></header>
    <p className={styles.note}>Solo el <strong>nombre de la propiedad</strong> es obligatorio. Crear la ficha <strong>no publica avisos ni envía mensajes.</strong></p>
    <form action={formAction} className={styles.form} aria-busy={pending}>
      {result.error && <p id="property-new-error" ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{result.error}</p>}
      <fieldset disabled={pending}><legend><IdentificationCard size={20} weight="duotone" aria-hidden="true" />Identificación</legend><div className={styles.formGrid}>
        {field('name', 'Nombre de la propiedad *', true, 'text', 'Ej. Departamento en Parque Norte')}
        {select('property_type', 'Tipo', propertyTypes.map(([value, label]) => ({ value, label, detail: 'Tipo de inmueble' })), <Buildings size={18} weight="duotone" aria-hidden="true" />)}
        {select('status', 'Estado', statuses.map(([value, label]) => ({ value, label, detail: 'Estado de la propiedad' })), <SealCheck size={18} weight="duotone" aria-hidden="true" />)}
      </div></fieldset>
      <fieldset disabled={pending}><legend><MapTrifold size={20} weight="duotone" aria-hidden="true" />Ubicación</legend><div className={styles.formGrid}>
        {field('address', 'Dirección', true, 'text', 'Calle, número, piso y unidad')}{field('neighborhood', 'Barrio / Zona')}{field('subzone', 'Subzona (opcional)')}{field('city', 'Localidad / Ciudad', true)}{field('province', 'Provincia', true)}
      </div></fieldset>
      <fieldset disabled={pending}><legend><Ruler size={20} weight="duotone" aria-hidden="true" />Características y precio</legend><div className={styles.featureGrid}>
        {field('surface_total_m2', 'Superficie total (m²)', false, 'number', undefined, '0.01')}{field('surface_covered_m2', 'Superficie cubierta (m²)', false, 'number', undefined, '0.01')}{field('rooms', 'Ambientes', false, 'number')}
        {select('currency', 'Moneda', [{ value: 'USD', label: 'USD', detail: 'Dólares' }, { value: 'ARS', label: 'ARS', detail: 'Pesos' }], <CurrencyDollar size={18} weight="duotone" aria-hidden="true" />)}{field('price', 'Precio registrado', false, 'number', '0,00', '0.01')}
      </div></fieldset>
      <fieldset disabled={pending}><legend><Scales size={20} weight="duotone" aria-hidden="true" />Datos legales y observaciones</legend><div className={styles.formGrid}>
        {field('matricula', 'Matrícula / Catastro', true)}{field('owners', 'Titular(es)', true)}{field('gravamenes', 'Gravámenes / inhibiciones', true)}{field('notes', 'Observaciones', true, 'text', 'Notas internas o detalles de la propiedad')}
      </div></fieldset>
      <div className={styles.actions}><AppButton variant="secondary" disabled={pending} onClick={cancel}>Cancelar</AppButton><AppButton type="submit" disabled={pending} className={styles.primary}>{pending ? 'Guardando…' : 'Guardar propiedad'}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton></div>
    </form>
    <p className={styles.footer}>Después de guardar, volvés al listado de Propiedades. Las herramientas comerciales y la ayuda documental están en la ficha.</p>
  </div>;
}
