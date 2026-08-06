'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { calcularAjuste, periodoDeFecha } from '@/lib/rentals/calcularAjuste';
import { calcularProximoAjuste } from '@/lib/rentals/labels';

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  let str = String(value).trim().replace(/\s/g, '');
  if (str === '') return null;
  // Formato es-AR: si hay coma, es el decimal (y los puntos son miles).
  // Si no hay coma, los puntos son separadores de miles.
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(/\./g, '');
  }
  const num = Number(str);
  return isNaN(num) ? null : num;
}

function parseString(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

export async function createRentalContract(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const base_amount = parseNumber(formData.get('base_amount'));
  const start_date = parseString(formData.get('start_date'));

  if (base_amount === null || !start_date) {
    throw new Error('El monto inicial y la fecha de inicio son requeridos');
  }

  const rentalData = {
    organization_id: profile.organization_id,
    property_id: parseString(formData.get('property_id')),
    tenant_name: parseString(formData.get('tenant_name')),
    base_amount,
    current_amount: base_amount,
    currency: parseString(formData.get('currency')),
    index_type: parseString(formData.get('index_type')),
    fixed_pct: parseNumber(formData.get('fixed_pct')),
    adjustment_period_months: parseNumber(formData.get('adjustment_period_months')),
    start_date,
    last_adjustment_date: parseString(formData.get('last_adjustment_date')),
    status: parseString(formData.get('status')),
    notes: parseString(formData.get('notes')),
    created_by: user.id,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rental_contracts')
    .insert([rentalData])
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creando alquiler:', error);
    throw new Error('No se pudo crear el contrato de alquiler');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'rental_created' as any,
    resourceType: 'rental',
    resourceId: data.id,
  });

  revalidatePath('/alquileres');
  redirect('/alquileres');
}

export async function updateRentalContract(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=editar');
  }

  const id = parseString(formData.get('rental_id'));
  if (!id) {
    redirect('/alquileres');
  }

  const rentalData = {
    property_id: parseString(formData.get('property_id')),
    tenant_name: parseString(formData.get('tenant_name')),
    base_amount: parseNumber(formData.get('base_amount')),
    currency: parseString(formData.get('currency')),
    index_type: parseString(formData.get('index_type')),
    fixed_pct: parseNumber(formData.get('fixed_pct')),
    adjustment_period_months: parseNumber(formData.get('adjustment_period_months')),
    start_date: parseString(formData.get('start_date')),
    last_adjustment_date: parseString(formData.get('last_adjustment_date')),
    status: parseString(formData.get('status')),
    notes: parseString(formData.get('notes')),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from('rental_contracts')
    .update(rentalData)
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Error actualizando alquiler:', error);
    throw new Error('No se pudo actualizar el contrato de alquiler');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'rental_updated' as any,
    resourceType: 'rental',
    resourceId: id,
  });

  revalidatePath('/alquileres');
  revalidatePath(`/alquileres/${id}`);
  redirect(`/alquileres/${id}`);
}

export async function addIndexValue(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const index_type = parseString(formData.get('index_type'));
  
  let period = parseString(formData.get('period'));
  const period_month = parseString(formData.get('period_month'));
  const period_year = parseString(formData.get('period_year'));
  
  if (!period && period_month && period_year) {
    period = `${period_year}-${period_month}`;
  }

  const value = parseNumber(formData.get('value'));

  if (!index_type || !period || value === null) {
    throw new Error('Todos los campos son requeridos');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('rent_index_values')
    .upsert(
      {
        organization_id: profile.organization_id,
        index_type,
        period,
        value,
        created_by: user.id
      },
      { onConflict: 'organization_id, index_type, period' }
    );

  if (error) {
    console.error('Error guardando índice:', error);
    throw new Error('No se pudo guardar el índice');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'rent_index_added' as any,
    resourceType: 'rental',
    resourceId: 'index',
  });

  revalidatePath('/alquileres/indices');
}

export async function deleteIndexValue(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=borrar');
  }

  const id = parseString(formData.get('id'));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from('rent_index_values')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Error borrando índice:', error);
    throw new Error('No se pudo borrar el índice');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'rent_index_deleted' as any,
    resourceType: 'rental',
    resourceId: id,
  });

  revalidatePath('/alquileres/indices');
}

export async function aplicarAjusteAlquiler(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=editar');
  }

  const id = parseString(formData.get('rental_id'));
  if (!id) redirect('/alquileres');

  const supabase = await createClient();

  // Cargar contrato
  const { data: rentalData, error: errRental } = await supabase
    .from('rental_contracts')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (errRental || !rentalData) {
    redirect('/alquileres');
  }

  const baseDateStr = rentalData.last_adjustment_date || rentalData.start_date;
  const periodoBase = periodoDeFecha(baseDateStr);
  const nextDate = calcularProximoAjuste(rentalData.start_date, rentalData.last_adjustment_date, rentalData.adjustment_period_months);
  
  if (!nextDate) {
    throw new Error('No se puede calcular el próximo ajuste');
  }

  const periodoObjetivo = periodoDeFecha(nextDate.toISOString());

  let valorBase: number | null = null;
  let valorObjetivo: number | null = null;

  if (rentalData.index_type !== 'FIJO') {
    // Buscar en la DB
    const { data: indices } = await supabase
      .from('rent_index_values')
      .select('period, value')
      .eq('organization_id', profile.organization_id)
      .eq('index_type', rentalData.index_type)
      .in('period', [periodoBase, periodoObjetivo]);
      
    if (indices) {
      const b = indices.find(i => i.period === periodoBase);
      const o = indices.find(i => i.period === periodoObjetivo);
      if (b) valorBase = b.value;
      if (o) valorObjetivo = o.value;
    }
  }

  const res = calcularAjuste({
    indexType: rentalData.index_type,
    fixedPct: rentalData.fixed_pct,
    montoActual: rentalData.current_amount,
    periodoBase,
    periodoObjetivo,
    valorBase,
    valorObjetivo
  });

  if (!res.ok || typeof res.coeficiente !== 'number' || !Number.isFinite(res.coeficiente) || res.coeficiente <= 0 || typeof res.montoSugerido !== 'number' || !Number.isFinite(res.montoSugerido) || res.montoSugerido <= 0) {
    redirect(`/alquileres/${id}?error=${encodeURIComponent(res.motivo || 'Error de validación matemática en el cálculo del ajuste.')}`);
  }

  // Update
  const newDateStr = nextDate.toISOString();
  
  const { error: updErr } = await supabase
    .from('rental_contracts')
    .update({
      current_amount: res.montoSugerido,
      last_adjustment_date: newDateStr,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (updErr) {
    console.error('Error aplicando ajuste:', updErr);
    throw new Error('Error al aplicar el ajuste en la base');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'rental_adjusted' as any,
    resourceType: 'rental',
    resourceId: id,
    metadata: {
      monto_anterior: rentalData.current_amount,
      monto_nuevo: res.montoSugerido,
      coeficiente: res.coeficiente
    }
  });

  revalidatePath('/alquileres');
  revalidatePath(`/alquileres/${id}`);
  redirect(`/alquileres/${id}`);
}
