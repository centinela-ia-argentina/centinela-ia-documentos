import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import { canManageProperty, isUserRole, canUseAi } from '@/lib/permissions/roles';
import type { PropertyRecord } from '@/types/property';
import type { ClientRecord } from '@/types/client';
import { getCaseStatusLabel } from '@/lib/industries/caseConfig';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { evaluarMatch, ordenarPorMatch, type ResultadoMatch } from '@/lib/matching/match';
import { getDesiredPropertyTypeLabel, getOperationInterestLabel } from '@/lib/clients/labels';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Buildings, MapPin, CurrencyDollar, Ruler, Door, MapTrifold, Scales, NotePencil, Sparkle, ChatsCircle, FilePdf, Handshake, UsersThree, SealCheck, CheckCircle, XCircle, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { PropertyWorkspace } from './PropertyWorkspace';
import { PropertyMatchAiButton } from './PropertyMatchAiButton';
import { GenerarAvisoButton } from './GenerarAvisoButton';
import { DescargarFichaPdfButton } from './DescargarFichaPdfButton';
import { TasacionPanel } from './TasacionPanel';
import { PublicacionAsistidaPanel } from './PublicacionAsistidaPanel';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generatePropertyMessage } from '@/lib/whatsapp';
import styles from './PropertyDetail.module.css';

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !property) {
    notFound();
  }

  const record = property as PropertyRecord;
  const canManage = isUserRole(profile.role) && canManageProperty(profile.role);
  const useAi = isUserRole(profile.role) && canUseAi(profile.role);

  const { data: documentsData } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .limit(50);

  const documents = documentsData || [];

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industry = normalizeIndustryType(organization?.industry_type);

  const { data: operationsData } = await supabase
    .from('cases')
    .select('id, title, status')
    .eq('property_id', record.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  const operations = operationsData || [];

  const { data: comparablesData } = await supabase
    .from('property_comparables')
    .select('*')
    .eq('property_id', record.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });
    
  const comparables = comparablesData || [];

  let sortedMatches: { item: ClientRecord; match: ResultadoMatch }[] = [];
  if (record.status === 'disponible') {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .is('archived_at', null)
      .in('status', ['activo', 'en_seguimiento']);
      
    const clients = (clientsData || []) as ClientRecord[];
    
    const matches = clients
      .map(c => ({ item: c, match: evaluarMatch(c, record) }))
      .filter(m => m.match.elegible);
      
    sortedMatches = ordenarPorMatch(matches);
  }

  const present = (value: string | number | null | undefined, suffix = '') => value == null || value === '' ? 'No cargado' : `${value}${suffix}`;
  const legalFields = [['Matrícula / Catastro', record.matricula], ['Titular(es)', record.owners], ['Gravámenes / inhibiciones', record.gravamenes]];
  const locationFields = [['Dirección', record.address], ['Barrio / Zona', record.neighborhood], ['Subzona', record.subzone], ['Localidad / Ciudad', record.city], ['Provincia', record.province]];
  const criterionIcons = { tipo: Buildings, presupuesto: CurrencyDollar, ambientes: Door, zona: MapPin };
  return <AppShell>
    <Link href="/propiedades" className={styles.back}><ArrowLeft size={18} strokeWidth={1.7} aria-hidden="true" />Volver a propiedades</Link>
    <PropertyWorkspace key={`${record.id}:${record.updated_at}`} record={record} documents={documents} canManage={canManage} useAi={useAi}
      header={<div className={styles.heading}>
        <div className={styles.identity}><span><Buildings size={18} weight="duotone" aria-hidden="true" />{getPropertyTypeLabel(record.property_type)}</span><span className={styles.status}><SealCheck size={18} weight="duotone" aria-hidden="true" />{getPropertyStatusLabel(record.status)}</span></div>
        <h1>{record.name}</h1><p className={styles.address}><MapPin size={22} weight="duotone" aria-hidden="true" />{record.address || 'Sin dirección cargada'}</p>
        <div className={styles.facts}>
          <div><CurrencyDollar size={22} weight="duotone" aria-hidden="true" /><div><span>Precio registrado</span><strong>{record.price != null ? `${record.currency === 'USD' ? 'u$s' : '$'} ${record.price.toLocaleString('es-AR')}` : 'No cargado'}</strong></div></div>
          <div><Ruler size={22} weight="duotone" aria-hidden="true" /><div><span>Superficie total</span><strong>{present(record.surface_total_m2, ' m²')}</strong></div></div>
          <div><Buildings size={22} weight="duotone" aria-hidden="true" /><div><span>Superficie cubierta</span><strong>{present(record.surface_covered_m2, ' m²')}</strong></div></div>
          <div><Door size={22} weight="duotone" aria-hidden="true" /><div><span>Ambientes</span><strong>{present(record.rooms)}</strong></div></div>
        </div>
      </div>}
      ficha={<>
        <div className={styles.intro}><div><h2>Conocé la propiedad</h2><p>Una vista de consulta ordenada.{canManage ? ' Para modificar información, entrá en Editar propiedad.' : ' Acceso de consulta.'}</p></div></div>
        <div className={styles.readGrid}>
          <section className={styles.panel}><div className={styles.sectionHead}><span className={styles.icon}><MapTrifold size={26} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>CONTEXTO DEL INMUEBLE</span><h3>Ubicación</h3></div></div><dl className={styles.fields}>{locationFields.map(([label, value]) => <div key={label} className={label === 'Dirección' ? styles.full : undefined}><dt>{label}</dt><dd>{present(value)}</dd></div>)}</dl></section>
          <section className={styles.panel}><div className={styles.sectionHead}><span className={styles.icon}><Scales size={26} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>INFORMACIÓN REGISTRADA</span><h3>Datos legales</h3></div></div><dl className={styles.fields}>{legalFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{present(value)}</dd></div>)}</dl><p className={styles.note}><strong>Sin dato no significa sin restricciones.</strong> Verificá la documentación antes de utilizar esta información.</p></section>
          <section className={styles.observations}><h3><NotePencil size={24} weight="duotone" aria-hidden="true" />Observaciones</h3><p>{record.notes || 'Sin observaciones cargadas.'}</p></section>
        </div><p className={styles.meta}>Creada el {new Date(record.created_at).toLocaleDateString('es-AR')} · Consulta primero, edición a pedido</p>
      </>}
      comercial={<>
        <div className={styles.intro}><div><h2>Prepará la comunicación comercial</h2><p>Del borrador al registro de publicación, cada tarea tiene su espacio.</p></div></div>
        <p className={styles.note}>Preparar materiales <strong>no publica la propiedad ni envía mensajes.</strong></p>
        <div className={styles.taskRow}>
          <article className={styles.panel}><span className={styles.icon}><Sparkle size={28} weight="duotone" aria-hidden="true" /></span><span className={styles.eyebrow}>CREACIÓN ASISTIDA</span><h3>Aviso de la propiedad</h3><p>Prepará un borrador y revisalo antes de usarlo.</p>{useAi ? <GenerarAvisoButton propertyId={record.id} /> : <p>IA no disponible para tu rol.</p>}</article>
          <article className={styles.panel}><span className={styles.icon}><ChatsCircle size={28} weight="duotone" aria-hidden="true" /></span><span className={styles.eyebrow}>COMUNICACIÓN DIRECTA</span><h3>Mensaje de WhatsApp</h3><p>Preparar, elegir destinatario y enviar son pasos separados.</p><div className={styles.whatsapp}><WhatsAppIntentBuilder context="property" resourceId={record.id} defaultMessage={generatePropertyMessage(record)} /><span className={styles.whatsappArrow} aria-hidden="true"><ArrowRight size={18} strokeWidth={1.7} /></span></div></article>
          <article className={styles.panel}><span className={styles.icon}><FilePdf size={28} weight="duotone" aria-hidden="true" /></span><span className={styles.eyebrow}>EXPORTACIÓN DE LA FICHA</span><h3>Ficha en PDF</h3><p>Abre impresión para guardar como PDF. Incluye titulares, matrícula, gravámenes y notas: revisá antes de compartir.</p><DescargarFichaPdfButton name={record.name} propertyType={getPropertyTypeLabel(record.property_type)} status={getPropertyStatusLabel(record.status)} address={record.address} matricula={record.matricula} owners={record.owners} surfaceTotal={record.surface_total_m2} surfaceCovered={record.surface_covered_m2} rooms={record.rooms} gravamenes={record.gravamenes} notes={record.notes} price={record.price} currency={record.currency} /></article>
        </div><PublicacionAsistidaPanel key={record.id} property={record} canManage={canManage} />
      </>}
      tasacion={<><div className={styles.intro}><div><h2>Tasación y comparables</h2><p>Referencias para una estimación orientativa; el precio registrado no es una tasación.</p></div></div><TasacionPanel propertyId={record.id} propertyType={record.property_type ?? ''} comparables={comparables} canManage={canManage} useAi={useAi} /></>}
      vinculos={<>
        <div className={styles.intro}><div><h2>Vínculos de la propiedad</h2><p>Operaciones asociadas y coincidencias de criterios, sin confundirlas con interés confirmado.</p></div></div>
        <section className={styles.panel}><div className={styles.sectionHead}><span className={styles.icon}><Handshake size={26} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>ACTIVIDAD VINCULADA</span><h3>Operaciones de esta propiedad</h3></div></div>
          {operations.length ? <ul className={styles.operations}>{operations.map(op => <li key={op.id}><div><h4>{op.title}</h4><span className={styles.status}>{getCaseStatusLabel(op.status, industry)}</span></div><Link href={`/expedientes/${op.id}`} className={styles.linkAction}>Abrir operación<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></Link></li>)}</ul> : <p>Todavía no hay operaciones vinculadas a esta propiedad.</p>}
          <p className={styles.note}><strong>Estados independientes.</strong> El estado de una operación no reemplaza el estado de la propiedad.</p>
        </section>
        <section className={styles.panel}><div className={styles.sectionHead}><span className={styles.icon}><UsersThree size={26} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>COINCIDENCIAS DE BÚSQUEDA</span><h3>Clientes que podrían estar interesados</h3></div></div>
          {useAi && record.status === 'disponible' && sortedMatches.length > 0 && <PropertyMatchAiButton propertyId={record.id} />}
          {record.status !== 'disponible' ? <p>El matching se activa cuando la propiedad está en estado Disponible.</p> : sortedMatches.length ? <ul className={styles.matches}>{sortedMatches.map(({ item: c, match }) => <li key={c.id}>
            <div className={styles.matchHeader}><div><h4>{c.name}</h4><p>{getOperationInterestLabel(c.operation_interest)} · {getDesiredPropertyTypeLabel(c.desired_property_type)}</p></div><div className={styles.matchCount}><strong>{match.coincidencias}/{match.aplicables}</strong><span>criterios coincidentes</span><div className={styles.matchBars} aria-hidden="true">{match.criterios.filter(crit => crit.aplica).map(crit => <i key={crit.key} data-match={crit.cumple} />)}</div></div></div>
            <div className={styles.criteria}>{match.criterios.filter(crit => crit.aplica).map(crit => { const Icon = criterionIcons[crit.key]; const Mark = crit.cumple ? CheckCircle : XCircle; return <span key={crit.key} data-match={crit.cumple}><Icon size={19} weight="duotone" aria-hidden="true" /><span>{crit.label}<small>{crit.cumple ? 'Coincide' : 'No coincide'}</small></span><Mark size={17} weight="duotone" aria-hidden="true" /></span>; })}</div>
            <div className={styles.matchFooter}><p><MagnifyingGlass size={17} weight="duotone" aria-hidden="true" />{match.aplicables > 0 ? (match.coincidencias === match.aplicables ? 'Coincide en todos los criterios aplicables' : `${match.coincidencias} de ${match.aplicables} criterios aplicables coinciden`) : 'Sin criterios aplicables'}</p><Link href={`/clientes/${c.id}`} className={styles.linkAction}>Ver cliente<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></Link></div>
          </li>)}</ul> : <p>Aún no hay clientes activos con criterios que encajen.</p>}
          <p className={styles.note}>Coincidir en criterios no acredita interés confirmado ni garantiza una recomendación.</p>
        </section>
      </>}
    />
  </AppShell>;
}
