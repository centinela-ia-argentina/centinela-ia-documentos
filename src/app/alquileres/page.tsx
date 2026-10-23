import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { Plus, TrendingUp } from 'lucide-react';
import {RentalPortfolio} from './RentalPortfolio';
import {RentalCalendarIcon} from './RentalCalendarIcon';
import styles from './Rentals.module.css';
import type { RentalContract } from '@/types/rental';
import { calcularProximoAjuste, estadoVencimiento } from '@/lib/rentals/labels';

export default async function RentalsPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const industry = normalizeIndustryType(org?.industry_type);
  if (industry !== 'inmobiliaria') {
    redirect('/dashboard');
  }

  const { data, error } = await supabase
    .from('rental_contracts')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const rentals = (data || []) as RentalContract[];
  const canManage = isUserRole(profile.role) && canManageRental(profile.role);

  const propertyIds = [...new Set(rentals.map(r=>r.property_id).filter((id):id is string=>!!id))];
  const {data:linkedProperties} = propertyIds.length ? await supabase.from('properties').select('id, name').eq('organization_id',profile.organization_id).in('id',propertyIds) : {data:[]};
  const propertyNames = new Map((linkedProperties||[]).map(p=>[p.id,p.name]));

  const now = new Date();
  const rentalsData = rentals.map(r => {
    const proxAjuste = calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months);
    const estado = estadoVencimiento(proxAjuste, r.status, now);
    return { ...r, proxAjuste, estado, propertyName: r.property_id ? propertyNames.get(r.property_id) ?? null : null };
  });

  const vencidosCount = rentalsData.filter(r => r.estado.tipo === 'vencido').length;
  const proximosCount = rentalsData.filter(r => r.estado.tipo === 'proximo').length;
  const alDiaCount = rentalsData.filter(r => r.estado.tipo === 'al_dia').length;

  const orderMap = { vencido: 0, proximo: 1, al_dia: 2, sin_dato: 3 };
  rentalsData.sort((a, b) => {
    const diffTipo = orderMap[a.estado.tipo] - orderMap[b.estado.tipo];
    if (diffTipo !== 0) return diffTipo;
    
    if (a.proxAjuste && b.proxAjuste) {
      return a.proxAjuste.getTime() - b.proxAjuste.getTime();
    }
    return 0;
  });

  return <AppShell><div className={styles.root}><header className={styles.rentHead}><div><p className={styles.eyebrow}>GESTIÓN LOCATIVA</p><h1>Alquileres</h1><p>Controlá contratos, próximos ajustes y valores de referencia desde un único radar.</p></div>{canManage&&<div className={styles.headActions}><Link className={styles.btn} href="/alquileres/indices"><TrendingUp size={17} aria-hidden/>Índices de ajuste</Link><Link className={`${styles.btn} ${styles.primary}`} href="/alquileres/nuevo"><Plus size={17} aria-hidden/>Nuevo contrato</Link></div>}</header><div className={styles.radarStats}>{[{kind:'vencido' as const,count:vencidosCount,label:'Ajuste vencido'},{kind:'proximo' as const,count:proximosCount,label:'Próximo en 30 días'},{kind:'al_dia' as const,count:alDiaCount,label:'Contratos al día'}].map(stat=><div key={stat.kind} className={styles.radarStat}><RentalCalendarIcon kind={stat.kind}/><div><strong>{stat.count}</strong><span>{stat.label}</span></div></div>)}</div><RentalPortfolio rentals={rentalsData} canManage={canManage}/></div></AppShell>;
}
