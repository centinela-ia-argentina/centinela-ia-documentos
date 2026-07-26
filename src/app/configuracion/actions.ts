'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';

export async function updateOrganizationIndustryType(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const organizationId = String(formData.get('organization_id') || '');
  const industryType = String(formData.get('industry_type') || '');

  const selectableIndustries = ['legal', 'escribania', 'inmobiliaria'];
  if (!organizationId || !selectableIndustries.includes(industryType)) {
    redirect('/configuracion?error=industry_invalid');
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect('/configuracion?error=platform_unavailable');
  }

  const { data: owner } = await admin
    .from('platform_admins')
    .select('user_id, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  const isPlatformOwner = Boolean(owner);

  const { data: actingProfile } = await admin
    .from('profiles')
    .select('role, organization_id, status')
    .eq('id', user.id)
    .maybeSingle();

  const { data: currentOrganization } = await admin
    .from('organizations')
    .select('industry_type')
    .eq('id', organizationId)
    .maybeSingle();

  const currentIndustry = normalizeIndustryType(
    currentOrganization?.industry_type
  );
  const isUnset = currentIndustry === 'general';

  const isOrgAdmin =
    actingProfile?.role === 'admin' &&
    actingProfile?.status === 'active' &&
    actingProfile?.organization_id === organizationId;

  const canChange = isPlatformOwner || (isOrgAdmin && isUnset);

  if (!canChange) {
    redirect('/configuracion?error=industry_locked');
  }

  const { error } = await admin
    .from('organizations')
    .update({ industry_type: industryType })
    .eq('id', organizationId);

  if (error) {
    console.error('Organization industry update failed:', error);
    redirect('/configuracion?error=industry_update_failed');
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'organization_industry_updated',
    resource_type: 'organization',
    resource_id: organizationId,
    metadata: {
      from: currentOrganization?.industry_type ?? null,
      to: industryType,
    },
  });

  if (auditError) {
    console.error('Organization industry audit log failed:', auditError);
  }

  revalidatePath('/configuracion');
  revalidatePath('/documentos/subir');
  redirect('/configuracion?success=industry_updated');
}

export async function updateOrganizationName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const organizationId = String(formData.get('organization_id') || '');
  const name = String(formData.get('name') || '').trim();

  if (!organizationId || !name || name.length > 120) {
    redirect('/configuracion?error=name_invalid');
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect('/configuracion?error=platform_unavailable');
  }

  const { data: owner } = await admin
    .from('platform_admins')
    .select('user_id, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  const isPlatformOwner = Boolean(owner);

  const { data: actingProfile } = await admin
    .from('profiles')
    .select('role, organization_id, status')
    .eq('id', user.id)
    .maybeSingle();

  const isOrgAdmin =
    actingProfile?.role === 'admin' &&
    actingProfile?.status === 'active' &&
    actingProfile?.organization_id === organizationId;

  const canChange = isPlatformOwner || isOrgAdmin;

  if (!canChange) {
    redirect('/configuracion?error=name_locked');
  }

  const { data: currentOrganization } = await admin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  const { error } = await admin
    .from('organizations')
    .update({ name })
    .eq('id', organizationId);

  if (error) {
    console.error('Organization name update failed:', error);
    redirect('/configuracion?error=name_update_failed');
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'organization_name_updated',
    resource_type: 'organization',
    resource_id: organizationId,
    metadata: {
      from: currentOrganization?.name ?? null,
      to: name,
    },
  });

  if (auditError) {
    console.error('Organization name audit log failed:', auditError);
  }

  revalidatePath('/configuracion');
  redirect('/configuracion?success=name_updated');
}

export async function updateOrganizationLogo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const organizationId = String(formData.get('organization_id') || '');
  const file = formData.get('logo') as File | null;

  if (!organizationId || !file || file.size === 0) {
    redirect('/configuracion?error=logo_invalid');
  }

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!validTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
    redirect('/configuracion?error=logo_invalid');
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect('/configuracion?error=platform_unavailable');
  }

  const { data: owner } = await admin
    .from('platform_admins')
    .select('user_id, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  const isPlatformOwner = Boolean(owner);

  const { data: actingProfile } = await admin
    .from('profiles')
    .select('role, organization_id, status')
    .eq('id', user.id)
    .maybeSingle();

  const isOrgAdmin =
    actingProfile?.role === 'admin' &&
    actingProfile?.status === 'active' &&
    actingProfile?.organization_id === organizationId;

  const canChange = isPlatformOwner || isOrgAdmin;

  if (!canChange) {
    redirect('/configuracion?error=logo_locked');
  }

  const ext = file.type.split('/')[1] === 'svg+xml' ? 'svg' : file.type.split('/')[1];
  const path = `${organizationId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from('branding')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error('Logo upload failed:', uploadError);
    redirect('/configuracion?error=logo_upload_failed');
  }

  const { data: publicUrlData } = admin.storage.from('branding').getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await admin
    .from('organizations')
    .update({ logo_url: publicUrl })
    .eq('id', organizationId);

  if (updateError) {
    console.error('Organization logo update failed:', updateError);
    redirect('/configuracion?error=logo_update_failed');
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'organization_logo_updated',
    resource_type: 'organization',
    resource_id: organizationId,
  });

  if (auditError) {
    console.error('Organization logo audit log failed:', auditError);
  }

  revalidatePath('/configuracion');
  redirect('/configuracion?success=logo_updated');
}

