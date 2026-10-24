import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { addIndexValue, deleteIndexValue } from '../actions';
import type { RentIndexValue } from '@/types/rental';
import { getIndexTypeLabel, formatPeriodo } from '@/lib/rentals/labels';
import styles from '../Rentals.module.css';

export default async function IndicesPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=ver');
  }

  const supabase = await createClient();
  const { data: indicesData } = await supabase
    .from('rent_index_values')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('index_type')
    .order('period', { ascending: false });

  const indices = (indicesData || []) as RentIndexValue[];

  return <AppShell><div className={styles.root}><Link href="/alquileres" className={styles.backBtn}><ArrowLeft size={16} aria-hidden/>Volver a alquileres</Link><header className={styles.detailHead}><div><p className={styles.eyebrow}>VALORES DE REFERENCIA</p><h1>Índices de ajuste</h1><p className={styles.scope}>Valores mensuales para calcular ICL, IPC y Casa Propia.</p></div></header><div className={styles.warning}><Info size={18} aria-hidden/><p>Verificá cada valor con su fuente oficial antes de usarlo para un ajuste contractual. Cargá el valor mensual publicado por BCRA (ICL) / INDEC (IPC). Para calcular se necesitan el mes base y el mes de ajuste previstos en el contrato.</p></div>
  <div className={styles.indicesGrid}><form action={addIndexValue} className={styles.indexForm} aria-label="Nuevo valor de índice"><h2>Nuevo valor</h2><div className={styles.field}><label htmlFor="index-type">Tipo de Índice *</label><select id="index-type" name="index_type" required><option value="ICL">ICL (BCRA)</option><option value="IPC">IPC (INDEC)</option><option value="CASA_PROPIA">Casa Propia</option></select></div><div className={styles.formGrid}><div className={styles.field}><label htmlFor="index-month">Mes *</label><select id="index-month" name="period_month" required defaultValue=""><option value="" disabled>Mes</option>{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((month,i)=><option key={month} value={String(i+1).padStart(2,'0')}>{month}</option>)}</select></div><div className={styles.field}><label htmlFor="index-year">Año *</label><select id="index-year" name="period_year" required defaultValue=""><option value="" disabled>Año</option>{[2023,2024,2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}</select></div></div><div className={styles.field}><label htmlFor="index-value">Valor del índice *</label><input id="index-value" type="text" inputMode="decimal" name="value" required placeholder="4,5" aria-describedby="index-value-help"/><p className={styles.scope} id="index-value-help">Usá coma para decimales (ej: 4,5)</p></div><FormSubmitButton label="Guardar valor" loadingLabel="Guardando..."/></form>
  <section className={styles.indexList}><h2>Valores registrados</h2>{indices.length===0?<p className={styles.cardBody}>No hay valores cargados en el sistema.</p>:indices.map(idx=><div key={idx.id} className={styles.indexRow}><div><strong>{formatPeriodo(idx.period)}</strong><span>{getIndexTypeLabel(idx.index_type)}</span></div><div><strong>{idx.value}</strong><span>Valor informado</span></div><form action={deleteIndexValue}><input type="hidden" name="id" value={idx.id}/><button type="submit" title="Eliminar índice" aria-label={`Eliminar valor ${getIndexTypeLabel(idx.index_type)} ${formatPeriodo(idx.period)}`}><Trash2 size={18} aria-hidden/></button></form></div>)}</section></div></div></AppShell>;
}
