'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { canManageProperty, isUserRole, canUseAi } from '@/lib/permissions/roles';
import { extraerDatosPropiedadDeArchivo } from '@/lib/ai/extraerPropiedad';
import { generarAvisoPropiedad } from '@/lib/ai/generarAviso';
import { tasarPropiedadIA, ComparableProp } from '@/lib/ai/tasador';

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

export async function createProperty(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const name = parseString(formData.get('name'));
  if (!name) {
    throw new Error('El nombre de la propiedad es requerido');
  }

  const propertyData = {
    organization_id: profile.organization_id,
    name,
    property_type: parseString(formData.get('property_type')),
    address: parseString(formData.get('address')),
    matricula: parseString(formData.get('matricula')),
    surface_total_m2: parseNumber(formData.get('surface_total_m2')),
    surface_covered_m2: parseNumber(formData.get('surface_covered_m2')),
    rooms: parseNumber(formData.get('rooms')),
    status: parseString(formData.get('status')),
    price: parseNumber(formData.get('price')),
    currency: parseString(formData.get('currency')),
    owners: parseString(formData.get('owners')),
    gravamenes: parseString(formData.get('gravamenes')),
    notes: parseString(formData.get('notes')),
    province: parseString(formData.get('province')),
    city: parseString(formData.get('city')),
    neighborhood: parseString(formData.get('neighborhood')),
    subzone: parseString(formData.get('subzone')),
    publication_status: parseString(formData.get('publication_status')) || 'no_publicada',
    publication_url_mercadolibre: parseString(formData.get('publication_url_mercadolibre')),
    publication_url_zonaprop: parseString(formData.get('publication_url_zonaprop')),
    publication_url_argenprop: parseString(formData.get('publication_url_argenprop')),
    publication_url_other: parseString(formData.get('publication_url_other')),
    publication_notes: parseString(formData.get('publication_notes')),
    created_by: user.id,
  };

  const supabase = await createClient();
  let { data, error } = await supabase
    .from('properties')
    .insert([propertyData])
    .select('id')
    .single();

  // Fallback if migration hasn't run on Vercel Preview (missing columns)
  // PostgREST returns code 'PGRST204' or message 'Could not find the X column'
  if (error && (error.code === 'PGRST204' || (error.message && (error.message.includes('does not exist') || error.message.includes('Could not find') || error.message.includes('column'))))) {
     
    const { 
      province, city, neighborhood, subzone, 
      publication_status, publication_url_mercadolibre, 
      publication_url_zonaprop, publication_url_argenprop, 
      publication_url_other, publication_notes, 
      ...oldPropertyData 
    } = propertyData as any;
    
    const retry = await supabase
      .from('properties')
      .insert([oldPropertyData])
      .select('id')
      .single();
      
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    throw new Error('No se pudo crear la propiedad');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'property_created' as any,
    resourceType: 'property',
    resourceId: data.id,
    metadata: { name },
  });

  revalidatePath('/propiedades');
  redirect('/propiedades');
}

import { analizarMatchConIA } from '@/lib/ai/analizarMatch';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import { getPropertyTypeLabel } from '@/lib/properties/labels';

export async function analizarMatchPropiedadIA(propertyId: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { profile } = await getUserProfile();
  if (!profile || !isUserRole(profile.role) || !canUseAi(profile.role)) {
    return { ok: false, error: 'Sin permiso de IA' };
  }

  const supabase = await createClient();

  const { data: propData, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (propErr || !propData) {
    return { ok: false, error: 'Propiedad no encontrada' };
  }

  const property = propData as PropertyRecord;

  const { data: clientsData } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .in('status', ['activo', 'en_seguimiento']);

  const clients = (clientsData || []) as ClientRecord[];

  const matches = clients
    .map(c => ({ item: c, match: evaluarMatch(c, property) }))
    .filter(m => m.match.elegible && m.match.coincidencias >= 1);

  const topMatches = ordenarPorMatch(matches).slice(0, 5);

  let contexto = `DATOS DE LA PROPIEDAD:
Nombre: ${property.name}
Tipo: ${getPropertyTypeLabel(property.property_type)}
Precio: ${property.price || 'S/N'} ${property.currency || ''}
Superficie: ${property.surface_total_m2 || 'S/N'} m²
Ambientes: ${property.rooms || 'S/N'}
Dirección: ${property.address || 'S/N'}

CLIENTES CANDIDATOS (Top ${topMatches.length}):
`;

  topMatches.forEach((m, idx) => {
    const c = m.item;
    contexto += `
[Opción ${idx + 1}]
Cliente: ${c.name}
Interés: ${c.operation_interest || 'Cualquiera'}
Tipo Buscado: ${c.desired_property_type || 'Cualquiera'}
Zona Buscada: ${c.zone || 'Cualquiera'}
Presupuesto: ${c.budget_min || 0} - ${c.budget_max || 'Sin límite'} ${c.currency || ''}
Ambientes Mínimos: ${c.min_rooms || 'Cualquiera'}
Puntaje de Match: ${m.match.coincidencias}/${m.match.aplicables} criterios
`;
    m.match.criterios.filter(crit => crit.aplica).forEach(crit => {
      contexto += `- Criterio "${crit.label}": ${crit.cumple ? 'CUMPLE' : 'NO CUMPLE'}\n`;
    });
  });

  const textoIA = await analizarMatchConIA(contexto);

  if (!textoIA) {
    return { ok: false, error: 'No se pudo generar el análisis.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'property_match_ai' as any,
    resourceType: 'property',
    resourceId: propertyId,
  });

  return { ok: true, text: textoIA };
}

export async function generarAvisoPropiedadIA(propertyId: string) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role)) {
    return { ok: false, error: 'Sin permiso' };
  }
  if (!canUseAi(profile.role)) {
    return { ok: false, error: 'Sin permiso de IA' };
  }

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !property) {
    return { ok: false, error: 'Propiedad no encontrada' };
  }

  const result = await generarAvisoPropiedad({
    name: property.name,
    property_type: getPropertyTypeLabel(property.property_type),
    address: property.address || '',
    surface_total_m2: property.surface_total_m2,
    surface_covered_m2: property.surface_covered_m2,
    rooms: property.rooms,
    price: property.price,
    currency: property.currency || '',
  });

  if (!result.ok) {
    return { ok: false, error: 'No se pudo generar el aviso.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'property_ad_ai' as any,
    resourceType: 'property',
    resourceId: propertyId,
  });

  return { ok: true, text: result.texto };
}

export async function tasarPropiedadConIA(propertyId: string) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role)) {
    return { ok: false, error: 'Sin permiso' };
  }
  if (!canUseAi(profile.role)) {
    return { ok: false, error: 'Sin permiso de IA' };
  }

  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !property) {
    return { ok: false, error: 'Propiedad no encontrada' };
  }

  if (!property.currency || (property.currency !== 'ARS' && property.currency !== 'USD')) {
    return { ok: false, error: 'La propiedad sujeto debe tener una moneda válida (ARS o USD) para ser tasada.' };
  }

  // 1. Fetch external comparables (property specific first, then general compatible)
  const { data: extCompsData } = await supabase
    .from('property_comparables')
    .select('source_name, surface_total_m2, rooms, price, currency, address, property_id')
    .eq('organization_id', profile.organization_id)
    .eq('property_id', propertyId) // Strict match to this property as requested
    .eq('currency', property.currency)
    .gt('price', 0)
    .gt('surface_total_m2', 0);

  const extCompsRaw = extCompsData || [];

  const comparables: ComparableProp[] = extCompsRaw.map(c => ({
    name: (c.source_name ? c.source_name : 'Portal / Manual') + (c.address ? ` - ${c.address}` : ''),
    surfaceTotal: c.surface_total_m2,
    rooms: c.rooms,
    price: c.price,
    currency: c.currency,
    sourceType: 'external',
  }));

  // 2. If we need more, fetch internal portfolio properties
  if (comparables.length < 10) {
    const { data: intCompsData } = await supabase
      .from('properties')
      .select('name, surface_total_m2, rooms, price, currency, address')
      .eq('organization_id', profile.organization_id)
      .eq('property_type', property.property_type)
      .neq('id', propertyId)
      .eq('currency', property.currency)
      .gt('price', 0)
      .gt('surface_total_m2', 0)
      .not('price', 'is', null)
      .not('surface_total_m2', 'is', null)
      .limit(10 - comparables.length);

    const intComps: ComparableProp[] = (intCompsData || []).map(c => ({
      name: c.name + (c.address ? ` - ${c.address}` : ''),
      surfaceTotal: c.surface_total_m2,
      rooms: c.rooms,
      price: c.price,
      currency: c.currency,
      sourceType: 'internal',
    }));

    comparables.push(...intComps);
  }

  // BLOQUEO ESTRICTO: No llamar a IA si no hay comparables
  if (comparables.length === 0) {
    return { 
      ok: false, 
      error: 'No hay comparables válidos de la misma moneda y tipo para generar una estimación. Cargá al menos un comparable con precio y superficie total.' 
    };
  }

  const result = await tasarPropiedadIA({
    name: property.name,
    propertyType: getPropertyTypeLabel(property.property_type),
    address: property.address || '',
    surfaceTotal: property.surface_total_m2,
    surfaceCovered: property.surface_covered_m2,
    rooms: property.rooms,
    currency: property.currency || '',
  }, comparables);

  if (!result.ok) {
    if (result.motivo === 'sin_comparables') {
      return { ok: false, error: 'No hay comparables válidos de la misma moneda y tipo para generar una estimación. Cargá al menos un comparable con precio y superficie total.' };
    }
    return { ok: false, error: 'No se pudo generar la tasación.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'property_valuation_ai' as any,
    resourceType: 'property',
    resourceId: propertyId,
  });

  return { ok: true, text: result.texto };
}

export async function updateProperty(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const propertyId = parseString(formData.get('property_id'));
  if (!propertyId) {
    redirect('/propiedades');
  }

  const name = parseString(formData.get('name'));
  if (!name) {
    throw new Error('El nombre de la propiedad es requerido');
  }

  const propertyData = {
    name,
    property_type: parseString(formData.get('property_type')),
    address: parseString(formData.get('address')),
    matricula: parseString(formData.get('matricula')),
    surface_total_m2: parseNumber(formData.get('surface_total_m2')),
    surface_covered_m2: parseNumber(formData.get('surface_covered_m2')),
    rooms: parseNumber(formData.get('rooms')),
    status: parseString(formData.get('status')),
    price: parseNumber(formData.get('price')),
    currency: parseString(formData.get('currency')),
    owners: parseString(formData.get('owners')),
    gravamenes: parseString(formData.get('gravamenes')),
    notes: parseString(formData.get('notes')),
    province: parseString(formData.get('province')),
    city: parseString(formData.get('city')),
    neighborhood: parseString(formData.get('neighborhood')),
    subzone: parseString(formData.get('subzone')),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  let { error } = await supabase
    .from('properties')
    .update(propertyData)
    .eq('id', propertyId)
    .eq('organization_id', profile.organization_id);

  // Fallback if migration hasn't run on Vercel Preview (missing columns)
  // PostgREST returns code 'PGRST204' or message 'Could not find the X column'
  if (error && (error.code === 'PGRST204' || (error.message && (error.message.includes('does not exist') || error.message.includes('Could not find') || error.message.includes('column'))))) {
     
    const { 
      province, city, neighborhood, subzone, 
      ...oldPropertyData 
    } = propertyData as any;
    
    const retry = await supabase
      .from('properties')
      .update(oldPropertyData)
      .eq('id', propertyId)
      .eq('organization_id', profile.organization_id);
      
    error = retry.error;
  }

  if (error) {
    throw new Error('No se pudo actualizar la propiedad');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'property_updated' as any,
    resourceType: 'property',
    resourceId: propertyId,
    metadata: { name },
  });

  revalidatePath('/propiedades');
  revalidatePath(`/propiedades/${propertyId}`);
  redirect(`/propiedades/${propertyId}`);
}

export async function extraerDatosPropiedadIA(propertyId: string, documentId: string) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role)) {
    return { ok: false, error: 'no_autenticado' };
  }
  if (!canUseAi(profile.role)) {
    return { ok: false, error: 'sin_permiso' };
  }

  const supabase = await createClient();

  // Validar propiedad
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (propError || !property) {
    return { ok: false, error: 'propiedad_no_encontrada' };
  }

  // Validar documento
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('file_path, file_mime_type')
    .eq('id', documentId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (docError || !document) {
    return { ok: false, error: 'documento_no_encontrado' };
  }

  // Descargar archivo
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(document.file_path);

  if (downloadError || !fileData) {
    console.error('Error al descargar archivo:', downloadError);
    return { ok: false, error: 'error_descarga' };
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mimeType = document.file_mime_type || fileData.type;

  const extractedData = await extraerDatosPropiedadDeArchivo(buffer, mimeType);

  if (!extractedData) {
    return { ok: false, error: 'error_ia' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'property_ai_extract' as any,
    resourceType: 'property',
    resourceId: propertyId,
  });

  return { ok: true, data: extractedData };
}

export async function aplicarDatosIAPropiedad(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const propertyId = parseString(formData.get('property_id'));
  if (!propertyId) {
    redirect('/propiedades');
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  const setIfPresent = (key: string, value: any) => {
    if (value !== null && value !== undefined && value !== '') {
      updatePayload[key] = value;
    }
  };

  setIfPresent('address', parseString(formData.get('direccion')));
  setIfPresent('property_type', parseString(formData.get('tipo_propiedad')));
  setIfPresent('matricula', parseString(formData.get('matricula')));
  setIfPresent('surface_total_m2', parseNumber(formData.get('superficie_total_m2')));
  setIfPresent('surface_covered_m2', parseNumber(formData.get('superficie_cubierta_m2')));
  setIfPresent('rooms', parseNumber(formData.get('ambientes')));
  setIfPresent('owners', parseString(formData.get('titulares')));
  setIfPresent('gravamenes', parseString(formData.get('gravamenes')));
  setIfPresent('notes', parseString(formData.get('observaciones')));

  if (Object.keys(updatePayload).length > 1) { // > 1 porque siempre tiene updated_at
    const supabase = await createClient();
    const { error } = await supabase
      .from('properties')
      .update(updatePayload)
      .eq('id', propertyId)
      .eq('organization_id', profile.organization_id);

    if (error) {
      throw new Error('No se pudo aplicar los datos de la IA');
    }

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'property_ai_autofill' as any,
      resourceType: 'property',
      resourceId: propertyId,
    });
  }

  revalidatePath(`/propiedades/${propertyId}`);
  redirect(`/propiedades/${propertyId}`);
}

export async function crearComparable(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageProperty(profile.role)) {
    return { ok: false, error: 'Sin permiso' };
  }

  const propertyId = parseString(formData.get('property_id'));
  
  const comparableData = {
    organization_id: profile.organization_id,
    property_id: propertyId,
    property_type: parseString(formData.get('property_type')),
    province: parseString(formData.get('province')),
    city: parseString(formData.get('city')),
    neighborhood: parseString(formData.get('neighborhood')),
    subzone: parseString(formData.get('subzone')),
    address: parseString(formData.get('address')),
    surface_total_m2: parseNumber(formData.get('surface_total_m2')),
    surface_covered_m2: parseNumber(formData.get('surface_covered_m2')),
    rooms: parseNumber(formData.get('rooms')),
    price: parseNumber(formData.get('price')) || 0,
    currency: parseString(formData.get('currency')) || 'USD',
    source_name: parseString(formData.get('source_name')),
    source_url: parseString(formData.get('source_url')),
    reference_date: parseString(formData.get('reference_date')),
    notes: parseString(formData.get('notes')),
    created_by: user.id,
  };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from('property_comparables')
    .insert([comparableData])
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: 'No se pudo crear el comparable' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'comparable_created' as any,
    resourceType: 'property_comparables' as any,
    resourceId: data.id,
  });

  if (propertyId) {
    revalidatePath(`/propiedades/${propertyId}`);
  }
  return { ok: true };
}

export async function eliminarComparable(comparableId: string, propertyId?: string) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageProperty(profile.role)) {
    return { ok: false, error: 'Sin permiso' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('property_comparables')
    .delete()
    .eq('id', comparableId)
    .eq('organization_id', profile.organization_id);

  if (error) {
    return { ok: false, error: 'No se pudo eliminar el comparable' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'comparable_deleted' as any,
    resourceType: 'property_comparables' as any,
    resourceId: comparableId,
  });

  if (propertyId) {
    revalidatePath(`/propiedades/${propertyId}`);
  }
  return { ok: true };
} 
