'use server';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { isUserRole, canUpdateCase, canUploadDocument } from '@/lib/permissions/roles';

export async function aceptarDerivacion(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') redirect('/login');
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) redirect('/acceso-denegado');

  const supabase = await createClient();
  
  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('*')
    .eq('id', id)
    .single();

  if (!derivacion || derivacion.status !== 'pendiente') return;

  const esOrgDestino = derivacion.to_organization_id === profile.organization_id;
  const esEmailDestino = derivacion.to_email.toLowerCase() === user.email?.toLowerCase();
  
  if (!esOrgDestino && !esEmailDestino) return;

  const { error, count } = await supabase
    .from('case_derivations')
    .update({
      status: 'aceptada',
      to_organization_id: profile.organization_id,
      accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pendiente');

  if (error) {
    console.error('Error al aceptar derivacion:', error);
    return;
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'aceptar_derivacion',
    entity_type: 'case_derivations',
    entity_id: id,
    details: { case_id: derivacion.case_id }
  });

  revalidatePath('/recibidos');
}

export async function rechazarDerivacion(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') redirect('/login');
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) redirect('/acceso-denegado');

  const supabase = await createClient();
  
  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('*')
    .eq('id', id)
    .single();

  if (!derivacion || derivacion.status !== 'pendiente') return;

  const esOrgDestino = derivacion.to_organization_id === profile.organization_id;
  const esEmailDestino = derivacion.to_email.toLowerCase() === user.email?.toLowerCase();
  
  if (!esOrgDestino && !esEmailDestino) return;

  const { error } = await supabase
    .from('case_derivations')
    .update({
      status: 'rechazada',
      accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pendiente');

  if (error) {
    console.error('Error al rechazar derivacion:', error);
    return;
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'rechazar_derivacion',
    entity_type: 'case_derivations',
    entity_id: id,
    details: { case_id: derivacion.case_id }
  });

  revalidatePath('/recibidos');
}

export async function agregarObservacion(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') redirect('/login');
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) redirect('/acceso-denegado');

  const derivationId = String(formData.get('derivation_id') || '');
  const caseId = String(formData.get('case_id') || '');
  const body = String(formData.get('body') || '').trim();

  if (!derivationId || !caseId || !body) {
    redirect(`/recibidos/${derivationId}`);
  }

  const supabase = await createClient();

  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('id, to_organization_id, from_organization_id, status, case_id')
    .eq('id', derivationId)
    .single();

  if (!derivacion || derivacion.case_id !== caseId) redirect('/acceso-denegado');
  if (derivacion.to_organization_id !== profile.organization_id && derivacion.from_organization_id !== profile.organization_id) {
    redirect('/acceso-denegado');
  }
  if (derivacion.status !== 'aceptada') redirect(`/recibidos/${derivationId}`);

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const { error } = await supabase.from('derivation_notes').insert({
    derivation_id: derivationId,
    case_id: caseId,
    author_organization_id: profile.organization_id,
    author_user_id: user.id,
    author_name: user.email || null,
    author_org_name: org?.name || null,
    body,
  });

  if (error) {
    console.error('Error al agregar observacion:', error);
  } else {
    await supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'crear_nota_derivacion',
      entity_type: 'derivation_notes',
      entity_id: derivationId,
      details: { case_id: caseId }
    });
  }

  revalidatePath(`/recibidos/${derivationId}`);
  redirect(`/recibidos/${derivationId}`);
}

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANO_MAX = 15 * 1024 * 1024;

function limpiarNombreArchivo(n: string) {
  return n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function subirDocumentoDerivado(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') redirect('/login');
  if (!isUserRole(profile.role) || !canUploadDocument(profile.role)) redirect('/acceso-denegado');

  const derivationId = String(formData.get('derivation_id') || '');
  const file = formData.get('file');

  if (!derivationId) redirect('/recibidos');
  if (!(file instanceof File)) redirect(`/recibidos/${derivationId}?error=archivo`);
  if (!TIPOS_PERMITIDOS.includes(file.type)) redirect(`/recibidos/${derivationId}?error=tipo`);
  if (file.size > TAMANO_MAX) redirect(`/recibidos/${derivationId}?error=tamano`);

  const supabase = await createClient();

  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('id, case_id, status, to_organization_id')
    .eq('id', derivationId)
    .single();

  if (!derivacion || derivacion.status !== 'aceptada' || derivacion.to_organization_id !== profile.organization_id) {
    redirect(`/recibidos/${derivationId}?error=permisos`);
  }

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, organization_id')
    .eq('id', derivacion.case_id)
    .single();

  if (!caseRecord) redirect(`/recibidos/${derivationId}?error=caso`);

  const { data: miOrg } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const documentId = randomUUID();
  const safeName = limpiarNombreArchivo(file.name);
  const storagePath = `${caseRecord.organization_id}/${caseRecord.id}/${documentId}/${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (upErr) {
    console.error('Error al subir documento derivado:', upErr);
    redirect(`/recibidos/${derivationId}?error=upload`);
  }

  const { error: insErr } = await supabase.from('documents').insert({
    id: documentId,
    organization_id: caseRecord.organization_id,
    case_id: caseRecord.id,
    file_name: file.name,
    file_path: storagePath,
    file_mime_type: file.type,
    file_size: file.size,
    document_type: null,
    sensitivity_level: 'medium',
    uploaded_by: user.id,
    contributed_by_organization_id: profile.organization_id,
    contributed_by_name: miOrg?.name || null,
  });

  if (insErr) {
    console.error('Error al registrar documento derivado:', insErr);
    await supabase.storage.from('documents').remove([storagePath]);
    redirect(`/recibidos/${derivationId}?error=metadata`);
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'subir_documento_colaborativo',
    entity_type: 'documents',
    entity_id: documentId,
    details: { case_id: caseRecord.id, derivation_id: derivationId }
  });

  revalidatePath(`/recibidos/${derivationId}`);
  redirect(`/recibidos/${derivationId}`);
}
