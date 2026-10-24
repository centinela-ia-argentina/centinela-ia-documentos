import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import {RentalDetailMode} from '../RentalDetailMode';
import {RentalContractForm} from '@/components/approved/forms/RentalContractForm';
import styles from '../Rentals.module.css';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { updateRentalContract } from '../actions';
import type { RentalContract } from '@/types/rental';
import { getIndexTypeLabel, getRentalStatusLabel, calcularProximoAjuste } from '@/lib/rentals/labels';
import { calcularAjuste, periodoDeFecha } from '@/lib/rentals/calcularAjuste';
import { AplicarAjusteButton } from './AplicarAjusteButton';
import { formatRentalDate, parseRentalDate } from '@/lib/rentals/calendar';

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: rentalData, error } = await supabase
    .from('rental_contracts')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !rentalData) {
    notFound();
  }

  const record = rentalData as RentalContract;
  const canManage = isUserRole(profile.role) && canManageRental(profile.role);

  let propertyName = null;
  if (record.property_id) {
    const { data: propData } = await supabase
      .from('properties')
      .select('name')
      .eq('id', record.property_id)
      .single();
    if (propData) {
      propertyName = propData.name;
    }
  }

  const { data: propertiesData } = await supabase
    .from('properties')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('name');

  const properties = propertiesData || [];
  
  const baseDateStr = record.last_adjustment_date || record.start_date;
  const proxAjuste = calcularProximoAjuste(record.start_date, record.last_adjustment_date, record.adjustment_period_months);

  const periodoBase = periodoDeFecha(baseDateStr);
  const periodoObjetivo = proxAjuste ? periodoDeFecha(proxAjuste.toISOString()) : '';

  let valorBase: number | null = null;
  let valorObjetivo: number | null = null;

  if (record.index_type !== 'FIJO' && periodoBase && periodoObjetivo) {
    const { data: indices } = await supabase
      .from('rent_index_values')
      .select('period, value')
      .eq('organization_id', profile.organization_id)
      .eq('index_type', record.index_type)
      .in('period', [periodoBase, periodoObjetivo]);
      
    if (indices) {
      const b = indices.find(i => i.period === periodoBase);
      const o = indices.find(i => i.period === periodoObjetivo);
      if (b) valorBase = b.value;
      if (o) valorObjetivo = o.value;
    }
  }

  let resAjuste = null;
  if (periodoBase && periodoObjetivo) {
    resAjuste = calcularAjuste({
      indexType: record.index_type,
      fixedPct: record.fixed_pct,
      montoActual: record.current_amount,
      periodoBase,
      periodoObjetivo,
      valorBase,
      valorObjetivo
    });
  }

  const fields = [
    ['Propiedad',propertyName||'Sin propiedad vinculada'],['Inquilino',record.tenant_name||'Sin inquilino'],
    ['Monto inicial',`${record.currency==='USD'?'u$s':'$'}${record.base_amount?record.base_amount.toLocaleString('es-AR'):'0'}`],
    ['Moneda',record.currency||'Sin definir'],['Índice',getIndexTypeLabel(record.index_type)],['Periodicidad',`Cada ${record.adjustment_period_months||'-'} meses`],
    ['Inicio',`Inicio: ${formatRentalDate(parseRentalDate(record.start_date))}`],['Último ajuste',formatRentalDate(parseRentalDate(record.last_adjustment_date))],['Estado',getRentalStatusLabel(record.status)],['Observaciones',record.notes||'Sin observaciones cargadas'],
  ];
  const readView=<section className={styles.card}><header className={styles.cardHead}><div><h2>Datos del contrato</h2><p>Información vigente para seguimiento.</p></div></header><dl className={styles.dataGrid}>{fields.map(([label,value])=><div key={label} className={`${styles.dataItem} ${label==='Observaciones'?styles.full:''}`}><dt>{label}</dt><dd className={label==='Observaciones'?styles.readonlyNotes:undefined}>{value}</dd></div>)}</dl></section>;
  return <AppShell><div className={styles.root}><Link href="/alquileres" className={styles.backBtn}><ArrowLeft size={16} aria-hidden/>Volver a alquileres</Link><header className={styles.detailHead}><div><p className={styles.eyebrow}>CONTRATO DE ALQUILER</p><h1>{record.tenant_name||'Contrato sin inquilino'}</h1><div className={styles.detailMeta}><span className={styles.status}>{getRentalStatusLabel(record.status)}</span>{propertyName&&<span className={styles.subtle}>{propertyName}</span>}</div></div></header>
  <div className={styles.detailGrid}><RentalDetailMode canManage={canManage} readView={readView} editForm={canManage?<RentalContractForm action={updateRentalContract} properties={properties} record={record}/>:null}/><aside className={styles.sideStack}>
  <section className={`${styles.card} ${styles.amountCard}`}><span>MONTO ACTUAL</span><h2>{record.currency==='USD'?'u$s':'$'}{record.current_amount?record.current_amount.toLocaleString('es-AR'):'0'}</h2>{record.base_amount&&record.base_amount!==record.current_amount?<p>Monto inicial: {record.currency==='USD'?'u$s':'$'}{record.base_amount.toLocaleString('es-AR')}</p>:null}</section>
  <section className={`${styles.card} ${styles.adjustCard}`}><h2>Próximo ajuste</h2>{proxAjuste?<><div className={styles.adjustDate}>{formatRentalDate(proxAjuste)}</div>{resAjuste?resAjuste.ok?<><div className={styles.suggestion}><span>MONTO SUGERIDO</span><strong>{record.currency==='USD'?'u$s':'$'}{resAjuste.montoSugerido?.toLocaleString('es-AR')}</strong><p>Coeficiente: {resAjuste.coeficiente?.toFixed(4)} ({resAjuste.periodoBase} → {resAjuste.periodoObjetivo})</p></div>{canManage&&<AplicarAjusteButton rentalId={record.id} montoLabel={`${record.currency==='USD'?'u$s':'$'}${resAjuste.montoSugerido?.toLocaleString('es-AR')}`} expectedUpdatedAt={record.updated_at}/>}</>:<><div className={styles.warning}><AlertTriangle size={18} aria-hidden/><span>{resAjuste.motivo}</span></div>{canManage&&<Link href="/alquileres/indices" className={styles.btn}>Cargar índice faltante</Link>}</>:null}</>:<p>Faltan datos de fecha o periodicidad para calcular.</p>}</section>
  {record.property_id&&propertyName&&<section className={`${styles.card} ${styles.amountCard}`}><span>PROPIEDAD VINCULADA</span><h2>{propertyName}</h2><Link className={styles.rowAction} href={`/propiedades/${record.property_id}`}>Ver propiedad <ArrowRight size={16} aria-hidden/></Link></section>}
  </aside></div></div></AppShell>;
}
