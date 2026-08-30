'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { generarResumenConIA, cotejarDocumentosConIA } from '@/lib/ai/copiloto';
import { redactarEscrituraConIA } from '@/lib/ai/escrituras';
import { redactarBorradorInmobiliariaConIA } from '@/lib/ai/borradorInmobiliaria';
import { calificarInquilinoConIA } from '@/lib/ai/preScore';
import { sugerirCoincidencias } from '@/lib/industries/checklistMatch';
import { redactarAvisoConIA } from '@/lib/ai/aviso';
import { analizarRiesgoUIF } from '@/lib/ai/uif';
import { canUseAi } from '@/lib/permissions/roles';
import {
  getAllowedCaseStatuses,
  getCaseStatuses,
} from '@/lib/industries/caseConfig';
import { getCaseTemplate } from '@/lib/industries/caseTemplates';
import { normalizeIndustryType, type IndustryType } from '@/lib/industries/documentTypes';
import {
  canCreateCase,
  canUpdateCase,
  canArchiveCase,
  canDeleteCase,
  isUserRole,
} from '@/lib/permissions/roles';
import { getChecklistItemsToInsert, getNextChecklistStatus, resolveCaseTypeForIndustry } from './helpers';

const CASE_METADATA_PREFIX = 'case_metadata.';

function denyCaseAction() {
  redirect('/acceso-denegado?motivo=rol&accion=expedientes');
}

async function requireCaseAccess(action: 'create' | 'update') {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const allowed =
    isUserRole(profile.role) &&
    (action === 'create'
      ? canCreateCase(profile.role)
      : canUpdateCase(profile.role));

  if (!allowed) denyCaseAction();

  return { user, profile };
}

function collectCaseMetadata(formData: FormData) {
  const metadata: Record<string, string> = {};
  let hasMetadataFields = false;

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(CASE_METADATA_PREFIX)) continue;

    hasMetadataFields = true;

    const fieldKey = key.slice(CASE_METADATA_PREFIX.length);
    const fieldValue = typeof value === 'string' ? value.trim() : '';

    if (fieldKey && fieldValue) {
      metadata[fieldKey] = fieldValue;
    }
  }

  return { metadata, hasMetadataFields };
}

async function getOrganizationIndustry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  const { data } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', organizationId)
    .maybeSingle();

  return normalizeIndustryType(data?.industry_type);
}

function resolveCaseStatus(
  requestedStatus: string,
  industry: ReturnType<typeof normalizeIndustryType>
) {
  const allowedStatuses = getAllowedCaseStatuses(industry);

  if (allowedStatuses.includes(requestedStatus)) {
    return requestedStatus;
  }

  return getCaseStatuses(industry)[0]?.value ?? 'active';
}

// Imported from helpers.ts
// export function getChecklistItemsToInsert...

async function createCaseChecklist(input: {
  caseId: string;
  organizationId: string;
  userId: string;
  caseType: string;
  industry: IndustryType;
}) {
  const template = getCaseTemplate(input.industry, input.caseType);
  if (!template) return;
  const checklistItems = template.checklist.filter((item) => item.trim());

  if (checklistItems.length === 0) return;

  const supabase = await createClient();

  // Busca si ya hay un checklist para este legajo
  let checklistId: string;
  const { data: existingChecklist } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', input.caseId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (existingChecklist) {
    checklistId = existingChecklist.id;
  } else {
    const { data: newChecklist, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        organization_id: input.organizationId,
        case_id: input.caseId,
        name: 'Checklist documental',
        template_type: input.caseType || 'Otro',
      })
      .select('id')
      .single();

    if (checklistError || !newChecklist) {
      console.error('Create case checklist error:', checklistError);
      return;
    }
    checklistId = newChecklist.id;
  }

  // Busca los items actuales
  const { data: currentItems } = await supabase
    .from('checklist_items')
    .select('title')
    .eq('checklist_id', checklistId);
  
  const newItems = getChecklistItemsToInsert(checklistItems, (currentItems ?? []).map(i => i.title));

  if (newItems.length > 0) {
    const { error: itemsError } = await supabase.from('checklist_items').insert(
      newItems.map((title) => ({
        organization_id: input.organizationId,
        checklist_id: checklistId,
        title,
        status: 'pending',
      }))
    );

    if (itemsError) {
      console.error('Create case checklist items error:', itemsError);
      return;
    }
  }

  await createAuditLog({
    organizationId: input.organizationId,
    userId: input.userId,
    action: 'case_checklist_created',
    resourceType: 'case',
    resourceId: input.caseId,
    metadata: {
      case_type: input.caseType,
      items_count: checklistItems.length,
    },
  });
}

export async function createCase(formData: FormData) {
  const { user, profile } = await requireCaseAccess('create');

  const title = String(formData.get('title') || '').trim();
  const clientName = String(formData.get('client_name') || '').trim();
  const rawCaseType = String(formData.get('case_type') || '');
  const requestedStatus = String(formData.get('status') || '');
  const propertyId = String(formData.get('property_id') || '');
  const { metadata } = collectCaseMetadata(formData);

  if (!title) {
    redirect('/expedientes/nuevo?error=missing_title');
  }

  const supabase = await createClient();
  
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (orgError || !orgData) {
    redirect('/expedientes/nuevo?error=invalid_industry');
  }

  const resolution = resolveCaseTypeForIndustry(
    orgData.industry_type,
    rawCaseType
  );

  if (!resolution.ok) {
    redirect(`/expedientes/nuevo?error=${resolution.error}`);
  }

  const { industry, caseType } = resolution;
  const status = resolveCaseStatus(requestedStatus, industry);

  const { data, error } = await supabase
    .from('cases')
    .insert({
      organization_id: profile.organization_id,
      title,
      client_name: clientName || null,
      case_type: caseType,
      status,
      property_id: propertyId || null,
      metadata,
      assigned_to: user.id,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Create case error:', error);
    redirect('/expedientes/nuevo?error=create_failed');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_created',
    resourceType: 'case',
    resourceId: data.id,
    metadata: {
      title,
      case_type: caseType,
      status,
      industry_type: industry,
    },
  });

  await createCaseChecklist({
    caseId: data.id,
    organizationId: profile.organization_id,
    userId: user.id,
    caseType,
    industry,
  });

  revalidatePath('/dashboard');
  revalidatePath('/expedientes');
  redirect(`/expedientes/${data.id}`);
}

export async function vincularPropiedadOperacion(formData: FormData) {
  const { profile } = await requireCaseAccess('update');
  
  const caseId = String(formData.get('case_id') || '');
  const propertyId = String(formData.get('property_id') || '');

  if (!caseId) {
    redirect('/expedientes');
  }

  const supabase = await createClient();

  if (propertyId) {
    // Validar que la propiedad pertenezca a la misma organización
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (propertyError || !property) {
      throw new Error('Propiedad no encontrada o sin acceso');
    }
  }

  const { error } = await supabase
    .from('cases')
    .update({ property_id: propertyId || null })
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Update case property_id error:', error);
    throw new Error('No se pudo vincular la propiedad');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: propertyId ? 'case_property_linked' : 'case_property_unlinked',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { property_id: propertyId || null },
  });

  revalidatePath(`/expedientes/${caseId}`);
  if (propertyId) {
    revalidatePath(`/propiedades/${propertyId}`);
  }
  redirect(`/expedientes/${caseId}`);
}

export async function updateCaseStatus(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const requestedStatus = String(formData.get('status') || '');
  const { metadata, hasMetadataFields } = collectCaseMetadata(formData);

  if (!caseId) {
    redirect('/expedientes');
  }

  const supabase = await createClient();
  const industry = await getOrganizationIndustry(supabase, profile.organization_id);
  const status = resolveCaseStatus(requestedStatus, industry);
  const updatePayload: {
    status: string;
    metadata?: Record<string, string>;
  } = { status };

  if (hasMetadataFields) {
    updatePayload.metadata = metadata;
  }

  const { error } = await supabase
    .from('cases')
    .update(updatePayload)
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id);

  if (!error) {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'case_status_updated',
      resourceType: 'case',
      resourceId: caseId,
      metadata: { status, industry_type: industry },
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/expedientes');
  revalidatePath(`/expedientes/${caseId}`);
  revalidatePath('/documentos');
  redirect(`/expedientes/${caseId}`);
}

// Imported from helpers.ts
// export function getNextChecklistStatus...

export async function toggleChecklistItem(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const itemId = String(formData.get('item_id') || '');

  if (!caseId || !itemId) {
    redirect('/expedientes');
  }

  const supabase = await createClient();

  const { data: checklistItem, error: itemError } = await supabase
    .from('checklist_items')
    .select('id, status, checklist_id')
    .eq('id', itemId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (itemError || !checklistItem) {
    console.error('Checklist item lookup error:', itemError);
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const actualCurrentStatus = checklistItem.status || 'pending';
  const nextStatus = getNextChecklistStatus(actualCurrentStatus);

  const { error } = await supabase
    .from('checklist_items')
    .update({ status: nextStatus })
    .eq('id', itemId);

  if (error) {
    console.error('Toggle checklist item error:', error);
  } else {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'checklist_item_toggled',
      resourceType: 'case',
      resourceId: caseId,
      metadata: {
        checklist_item_id: itemId,
        previous_status: actualCurrentStatus,
        next_status: nextStatus,
      },
    });
  }

  revalidatePath(`/expedientes/${caseId}`);
}

export async function linkChecklistItemDocument(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const itemId = String(formData.get('item_id') || '');
  const documentId = String(formData.get('document_id') || '').trim();

  if (!caseId || !itemId) {
    redirect('/expedientes');
  }

  const supabase = await createClient();

  const { data: checklistItem, error: itemError } = await supabase
    .from('checklist_items')
    .select('id, title, document_id, checklist_id')
    .eq('id', itemId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (itemError || !checklistItem) {
    console.error('Checklist item document link lookup error:', itemError);
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  let linkedDocumentId: string | null = null;

  if (documentId) {
    const { data: documentRecord, error: documentError } = await supabase
      .from('documents')
      .select('id, file_name, case_id')
      .eq('id', documentId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (documentError || !documentRecord) {
      console.error('Checklist document link document lookup error:', documentError);
      revalidatePath(`/expedientes/${caseId}`);
      return;
    }

    linkedDocumentId = documentRecord.id;

    if (documentRecord.case_id !== caseId) {
      console.error('Checklist document link rejected: document case_id does not match caseId');
      revalidatePath(`/expedientes/${caseId}`);
      return;
    }
  }

  const { error } = await supabase
    .from('checklist_items')
    .update({
      document_id: linkedDocumentId,
    })
    .eq('id', itemId);

  if (error) {
    console.error('Checklist item document link error:', error);
    revalidatePath(`/expedientes/${caseId}`);
    return;
  } else {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: linkedDocumentId
        ? 'checklist_item_linked'
        : 'checklist_item_unlinked',
      resourceType: 'case',
      resourceId: caseId,
      metadata: {
        checklist_item_id: itemId,
        document_id: linkedDocumentId,
      },
    });
  }

  revalidatePath(`/expedientes/${caseId}`);

  if (linkedDocumentId) {
    redirect(`/expedientes/${caseId}?tab=checklist&checklist_document=linked`);
  } else {
    redirect(`/expedientes/${caseId}?tab=checklist&checklist_document=unlinked`);
  }
}

export async function toggleChecklistItemNotRequired(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const itemId = String(formData.get('item_id') || '');

  if (!caseId || !itemId) redirect('/expedientes');
  const supabase = await createClient();

  const { data: checklistItem, error: itemError } = await supabase
    .from('checklist_items')
    .select('id, status, checklist_id')
    .eq('id', itemId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (itemError || !checklistItem) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const actualCurrentStatus = checklistItem.status || 'pending';
  const nextStatus = actualCurrentStatus === 'not_required' ? 'pending' : 'not_required';

  const { error } = await supabase
    .from('checklist_items')
    .update({ status: nextStatus })
    .eq('id', itemId);

  if (!error) {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'checklist_item_marked',
      resourceType: 'case',
      resourceId: caseId,
      metadata: { checklist_item_id: itemId, previous_status: actualCurrentStatus, next_status: nextStatus },
    });
  }
  revalidatePath(`/expedientes/${caseId}`);
}

export async function addChecklistItem(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const title = String(formData.get('title') || '').trim();

  if (!caseId || !title) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }
  const supabase = await createClient();

  let checklistId: string | undefined = undefined;
  const { data: existingChecklist } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingChecklist) {
    checklistId = existingChecklist.id;
  } else {
    const { data: newChecklist, error: newChecklistError } = await supabase
      .from('checklists')
      .insert({
        organization_id: profile.organization_id,
        case_id: caseId,
        name: 'Checklist documental',
        template_type: 'custom',
      })
      .select('id')
      .single();
    if (!newChecklistError && newChecklist) {
      checklistId = newChecklist.id;
    }
  }

  if (checklistId) {
    const { error } = await supabase
      .from('checklist_items')
      .insert({ organization_id: profile.organization_id, checklist_id: checklistId, title, status: 'pending' });

    if (!error) {
      await createAuditLog({
        organizationId: profile.organization_id,
        userId: user.id,
        action: 'checklist_item_added',
        resourceType: 'case',
        resourceId: caseId,
        metadata: { title },
      });
    }
  }
  revalidatePath(`/expedientes/${caseId}`);
}

export async function addChecklistItemConEstado(
  _prev: { ok: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean }> {
  await addChecklistItem(formData);
  return { ok: true };
}

export async function removeChecklistItem(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');

  const caseId = String(formData.get('case_id') || '');
  const itemId = String(formData.get('item_id') || '');

  if (!caseId || !itemId) redirect('/expedientes');
  const supabase = await createClient();

  const { data: checklistItem, error: itemError } = await supabase
    .from('checklist_items')
    .select('id, checklist_id')
    .eq('id', itemId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (itemError || !checklistItem) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId);

  if (!error) {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'checklist_item_removed',
      resourceType: 'case',
      resourceId: caseId,
      metadata: { checklist_item_id: itemId },
    });
  }
  revalidatePath(`/expedientes/${caseId}`);
}

export async function createCaseEvent(input: { caseId: string; eventDate: string; eventType: string; title: string; description?: string; }) {
  const { user, profile } = await requireCaseAccess('update');

  const title = input.title.trim();
  if (!title) {
    throw new Error('Title is required');
  }

  const supabase = await createClient();

  const { data: caseRecord, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (caseError || !caseRecord) {
    revalidatePath(`/expedientes/${input.caseId}`);
    return;
  }

  const { error } = await supabase
    .from('case_events')
    .insert({
      organization_id: profile.organization_id,
      case_id: input.caseId,
      event_date: input.eventDate,
      event_type: input.eventType || 'otro',
      title,
      description: input.description?.trim() || null,
      created_by: user.id
    });

  if (!error) {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'case_event_added',
      resourceType: 'case',
      resourceId: input.caseId,
      metadata: { title, event_type: input.eventType },
    });
  }

  revalidatePath(`/expedientes/${input.caseId}`);
}

export async function deleteCaseEvent(input: { eventId: string; caseId: string }) {
  const { user, profile } = await requireCaseAccess('update');

  const supabase = await createClient();

  const { error } = await supabase
    .from('case_events')
    .delete()
    .eq('id', input.eventId)
    .eq('organization_id', profile.organization_id);

  if (!error) {
    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'case_event_removed',
      resourceType: 'case',
      resourceId: input.caseId,
      metadata: { event_id: input.eventId },
    });
  }
  
  revalidatePath(`/expedientes/${input.caseId}`);
}

export async function generarResumenExpediente(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const { data: eventosData } = await supabase
    .from('case_events')
    .select('event_date, event_type, title, description')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .order('event_date', { ascending: true });
  const eventos = (eventosData ?? []).map((e) => ({
    fecha: String(e.event_date), tipo: String(e.event_type || 'otro'),
    titulo: String(e.title || ''), descripcion: String(e.description || ''),
  }));

  const industria = await getOrganizationIndustry(supabase, profile.organization_id);

  const result = await generarResumenConIA({
    titulo: caseRecord.title || 'Expediente',
    cliente: caseRecord.client_name || '',
    tipo: caseRecord.case_type || '',
    estado: caseRecord.status || '',
    industria,
    documentos, eventos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_summary',
    content: result.resumen.resumen_general,
    model_name: result.model,
    result_json: result.resumen,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_summary_generated',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { documentos: documentos.length, eventos: eventos.length },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function cotejarExpediente(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, case_type')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industria = normalizeIndustryType(organization?.industry_type);

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type, expires_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    const fechas = Array.isArray(r.fechas_plazos) 
      ? r.fechas_plazos.map((f: any) => `${f.descripcion}: ${f.fecha}`) 
      : [];
    if (d.expires_at) fechas.push(`Vencimiento registrado en sistema: ${d.expires_at}`);
    
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: [
        ...(Array.isArray(r.datos_clave) ? r.datos_clave.map(String) : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : [])),
        ...fechas
      ],
    };
  });

  const result = await cotejarDocumentosConIA({
    titulo: caseRecord.title || 'Legajo',
    tipo: caseRecord.case_type || '',
    industria,
    documentos,
  });

  if (!result.ok) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_cotejo',
    content: result.cotejo.veredicto,
    model_name: result.model,
    result_json: result.cotejo,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_cotejo_generated',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { documentos: documentos.length },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function redactarEscrituraExpediente(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resumenGeneral = String((resumenData?.result_json as any)?.resumen_general || '');
  const metadata = (caseRecord.metadata || {}) as Record<string, string>;

  const result = await redactarEscrituraConIA({
    titulo: caseRecord.title || 'Expediente',
    tipoActo: metadata.tipo_acto || caseRecord.case_type || '',
    comparecientes: metadata.comparecientes || caseRecord.client_name || '',
    registroProtocolo: metadata.registro_protocolo || '',
    fechaOtorgamiento: metadata.fecha_otorgamiento || '',
    resumenGeneral,
    documentos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_escritura',
    content: result.borrador.titulo,
    model_name: result.model,
    result_json: result.borrador,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_escritura_generated',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { model: result.model },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function analizarUifExpediente(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resumenGeneral = String((resumenData?.result_json as any)?.resumen_general || '');
  const metadata = (caseRecord.metadata || {}) as Record<string, string>;

  const result = await analizarRiesgoUIF({
    titulo: caseRecord.title || 'Expediente',
    tipoActo: metadata.tipo_acto || caseRecord.case_type || '',
    comparecientes: metadata.comparecientes || caseRecord.client_name || '',
    sensibilidad: metadata.sensibilidad || '',
    resumenGeneral,
    documentos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_uif',
    content: result.analisis.nivel_riesgo,
    model_name: result.model,
    result_json: result.analisis,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_uif_generated',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { model: result.model, nivel: result.analisis.nivel_riesgo },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function archiveCase(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canArchiveCase(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=expedientes');
  }

  const caseId = formData.get('case_id') as string;
  if (!caseId) redirect('/expedientes');

  const supabase = await createClient();
  await supabase
    .from('cases')
    .update({ status: 'archived' })
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_archived' as any,
    resourceType: 'case',
    resourceId: caseId,
  });

  revalidatePath('/dashboard');
  revalidatePath('/expedientes');
  revalidatePath(`/expedientes/${caseId}`);
}

export async function unarchiveCase(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canArchiveCase(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=expedientes');
  }

  const caseId = formData.get('case_id') as string;
  if (!caseId) redirect('/expedientes');

  const supabase = await createClient();
  
  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
    
  const industry = normalizeIndustryType(organization?.industry_type);
  const statuses = getCaseStatuses(industry);
  const firstActiveStatus = statuses[0]?.value ?? 'active';

  await supabase
    .from('cases')
    .update({ status: firstActiveStatus })
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_unarchived' as any,
    resourceType: 'case',
    resourceId: caseId,
  });

  revalidatePath('/dashboard');
  revalidatePath('/expedientes');
  revalidatePath(`/expedientes/${caseId}`);
}

export async function deleteCase(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canDeleteCase(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=expedientes');
  }

  const caseId = formData.get('case_id') as string;
  if (!caseId) redirect('/expedientes');

  const supabase = await createClient();
  const { data: caseData } = await supabase
    .from('cases')
    .select('id, title')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!caseData) redirect('/expedientes');

  // 1. DESVINCULAR documentos (NO borrarlos)
  await supabase
    .from('documents')
    .update({ case_id: null })
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);

  // 2. Borrar SOLO los análisis a nivel expediente
  await supabase
    .from('ai_outputs')
    .delete()
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .is('document_id', null);

  // 3. DELETE FROM case_events
  await supabase
    .from('case_events')
    .delete()
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);

  // 4. DELETE FROM agenda_plazos (si existe)
  const { error: deleteAgendaError } = await supabase
    .from('agenda_plazos')
    .delete()
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
    
  if (deleteAgendaError && deleteAgendaError.code !== '42P01') {
    console.error('Error deleting agenda_plazos:', deleteAgendaError);
  }

  // 5. Borrar checklist_items de los checklists de la operación, luego los checklists
  const { data: checklists } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);

  if (checklists && checklists.length > 0) {
    const checklistIds = checklists.map((c) => c.id);
    await supabase
      .from('checklist_items')
      .delete()
      .in('checklist_id', checklistIds);

    await supabase
      .from('checklists')
      .delete()
      .eq('case_id', caseId)
      .eq('organization_id', profile.organization_id);
  }

  // 6. DELETE FROM cases
  await supabase
    .from('cases')
    .delete()
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id);

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_deleted' as any,
    resourceType: 'case',
    resourceId: caseId,
    metadata: { title: caseData.title },
  });

  revalidatePath('/dashboard');
  revalidatePath('/expedientes');
  redirect('/expedientes');
}

export async function derivarAEscribania(formData: FormData) {
  const caseId = String(formData.get('case_id') || '');
  const toEmail = String(formData.get('to_email') || '').trim().toLowerCase();
  const mensaje = String(formData.get('mensaje') || '').trim();

  const { user, profile } = await requireCaseAccess('update');

  if (!caseId || !toEmail) {
    redirect('/expedientes');
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!caseRecord) {
    redirect('/expedientes');
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const { error } = await supabase.from('case_derivations').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    from_organization_id: profile.organization_id,
    from_organization_name: org?.name ?? null,
    case_title: caseRecord.title ?? null,
    to_email: toEmail,
    status: 'pendiente',
    mensaje: mensaje || null,
    created_by: user.id,
  });

  if (error) {
    console.error('Derivar a escribania error:', error);
  }

  revalidatePath(`/expedientes/${caseId}`);
  redirect(`/expedientes/${caseId}`);
}

export async function redactarAvisoExpediente(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata, property_id')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  // Propiedad vinculada (si la hay)
  let propiedad: { nombre: string; direccion: string; tipo: string; estado: string } | null = null;
  if (caseRecord.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('name, address, property_type, status')
      .eq('id', caseRecord.property_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();
    if (prop) {
      propiedad = {
        nombre: String(prop.name || ''),
        direccion: String(prop.address || ''),
        tipo: String(prop.property_type || ''),
        estado: String(prop.status || ''),
      };
    }
  }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resumenGeneral = String((resumenData?.result_json as any)?.resumen_general || '');
  const metadata = (caseRecord.metadata || {}) as Record<string, string>;

  const result = await redactarAvisoConIA({
    titulo: caseRecord.title || 'Operación',
    tipoOperacion: caseRecord.case_type || '',
    direccion: metadata.direccion_inmueble || propiedad?.direccion || '',
    valorOperacion: metadata.valor_operacion || '',
    propiedad,
    resumenGeneral,
    documentos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_aviso',
    content: result.aviso.titulo,
    model_name: result.model,
    result_json: result.aviso,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_aviso_generated' as any,
    resourceType: 'case',
    resourceId: caseId,
    metadata: { model: result.model },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function redactarBorradorInmobiliaria(caseId: string) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resumenGeneral = String((resumenData?.result_json as any)?.resumen_general || '');
  const metadata = (caseRecord.metadata || {}) as Record<string, string>;

  const result = await redactarBorradorInmobiliariaConIA({
    titulo: caseRecord.title || 'Operación',
    tipoDocumento: metadata.tipo_documento || caseRecord.case_type || 'Boleto de compraventa',
    tipoOperacion: caseRecord.case_type || '',
    partes: metadata.contraparte || caseRecord.client_name || '',
    valorOperacion: metadata.valor_operacion || '',
    inmueble: metadata.direccion_inmueble || '',
    resumenGeneral,
    documentos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'case_borrador_inmo',
    content: result.borrador.titulo,
    model_name: result.model,
    result_json: result.borrador,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'case_borrador_inmo_generated' as any,
    resourceType: 'case',
    resourceId: caseId,
    metadata: { model: result.model },
  });

  revalidatePath(`/expedientes/${caseId}`);
}

export async function autoMarcarChecklist(formData: FormData) {
  const { user, profile } = await requireCaseAccess('update');
  const caseId = String(formData.get('case_id') || '');
  if (!caseId) {
    redirect('/expedientes');
  }
  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!checklist) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }
  const { data: items } = await supabase
    .from('checklist_items')
    .select('id, title, status, document_id')
    .eq('checklist_id', checklist.id);
  const itemsCandidatos = (items ?? []).filter(
    (it) => (it.status === 'pending' && !it.document_id) || (it.status === 'received' && it.document_id)
  );
  if (itemsCandidatos.length === 0) {
    revalidatePath(`/expedientes/${caseId}`);
    return;
  }
  const { data: documentos } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const sugerencias = sugerirCoincidencias(
    itemsCandidatos.map((it) => ({ title: it.title })),
    (documentos ?? []).map((d) => ({
      id: d.id,
      file_name: d.file_name,
      document_type: d.document_type,
    }))
  );
  let marcados = 0;
  let desvinculados = 0;
  for (const item of itemsCandidatos) {
    const sugerencia = sugerencias.get(item.title);
    
    if (item.status === 'received' && item.document_id) {
      if (!sugerencia) {
        const { error } = await supabase
          .from('checklist_items')
          .update({ document_id: null, status: 'pending' })
          .eq('id', item.id);
        if (!error) desvinculados += 1;
      } else if (sugerencia.documentId !== item.document_id) {
        const { error } = await supabase
          .from('checklist_items')
          .update({ document_id: sugerencia.documentId, status: 'received' })
          .eq('id', item.id);
        if (!error) marcados += 1;
      }
    } else if (item.status === 'pending' && !item.document_id) {
      if (sugerencia) {
        const { error } = await supabase
          .from('checklist_items')
          .update({ document_id: sugerencia.documentId, status: 'received' })
          .eq('id', item.id);
        if (!error) marcados += 1;
      }
    }
  }
  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'checklist_auto_matched' as any,
    resourceType: 'case',
    resourceId: caseId,
    metadata: { auto_marcados: marcados, desvinculados, evaluados: itemsCandidatos.length },
  });
  revalidatePath(`/expedientes/${caseId}`);
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  let str = String(value).trim().replace(/\s/g, '');
  if (str === '') return null;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(/\./g, '');
  }
  const num = Number(str);
  return isNaN(num) ? null : num;
}

export async function calificarInquilinoExpediente(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    const caseIdFallback = formData.get('caseId') as string;
    if (caseIdFallback) revalidatePath(`/expedientes/${caseIdFallback}`);
    return;
  }

  const caseId = formData.get('caseId') as string;
  if (!caseId) return;

  const alquilerStr = formData.get('alquiler');
  const alquilerParsed = parseNumber(alquilerStr);
  const alquilerMensual = alquilerParsed ?? null;

  const moneda = formData.get('moneda') as string || 'ARS';

  const supabase = await createClient();

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) { revalidatePath(`/expedientes/${caseId}`); return; }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);
  const docs = docsData ?? [];

  const { data: outputsData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const latestByDoc = new Map<string, any>();
  for (const o of outputsData ?? []) {
    if (o.document_id && !latestByDoc.has(o.document_id)) latestByDoc.set(o.document_id, o.result_json);
  }

  const documentos = docs.map((d) => {
    const r = latestByDoc.get(d.id) || {};
    return {
      nombre: d.file_name,
      tipo: String(r.tipo_documental_detectado || d.document_type || 'Documento'),
      resumen: String(r.resumen || 'Sin análisis de IA todavía.'),
      alertas: Array.isArray(r.alertas) ? r.alertas.map(String) : [],
      datos: Array.isArray(r.datos_clave) ? r.datos_clave.map(String)
        : (Array.isArray(r.datos_relevantes) ? r.datos_relevantes.map(String) : []),
    };
  });

  const result = await calificarInquilinoConIA({
    titulo: caseRecord.title || 'Expediente',
    alquilerMensual: alquilerMensual ?? 0,
    moneda,
    documentos,
  });

  if (!result.ok) { revalidatePath(`/expedientes/${caseId}`); return; }

  await supabase.from('ai_outputs').insert({
    organization_id: profile.organization_id,
    case_id: caseId,
    document_id: null,
    output_type: 'prescore_inquilino',
    content: result.prescore.nivel_calificacion,
    model_name: result.model,
    result_json: result.prescore,
    created_by: user.id,
  });

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'prescore_generado' as any,
    resourceType: 'case',
    resourceId: caseId,
    metadata: { model: result.model, nivel: result.prescore.nivel_calificacion },
  });

  revalidatePath(`/expedientes/${caseId}`);
}
