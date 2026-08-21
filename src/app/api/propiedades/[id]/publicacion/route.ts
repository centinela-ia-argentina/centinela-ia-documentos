import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';

const VALID_STATUSES = ['no_publicada', 'en_preparacion', 'publicada', 'pausada'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const propertyId = (await params).id;
    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const { user, profile } = await getUserProfile();
    if (!user || !profile || !isUserRole(profile.role) || !canManageProperty(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 });
    }

    const body = await request.json();
    const publication_status = body.publication_status;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!VALID_STATUSES.includes(publication_status as any)) {
      return NextResponse.json({ ok: false, error: 'Estado de publicación inválido' }, { status: 400 });
    }

    const publication_notes = body.publication_notes ?? null;
    const publication_url_mercadolibre = body.publication_url_mercadolibre ?? null;
    const publication_url_zonaprop = body.publication_url_zonaprop ?? null;
    const publication_url_argenprop = body.publication_url_argenprop ?? null;
    const publication_url_other = body.publication_url_other ?? null;

    const supabase = await createClient();
    
    // First, verify the property exists and belongs to the organization
    const { data: prop, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (propError || !prop) {
      return NextResponse.json({ ok: false, error: 'Propiedad no encontrada o sin permiso' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('properties')
      .update({
        publication_status,
        publication_notes,
        publication_url_mercadolibre,
        publication_url_zonaprop,
        publication_url_argenprop,
        publication_url_other,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .eq('organization_id', profile.organization_id)
      .select('publication_status, publication_notes, publication_url_mercadolibre, publication_url_zonaprop, publication_url_argenprop, publication_url_other')
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'Error al actualizar publicación' }, { status: 500 });
    }

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: 'property_updated' as any,
      resourceType: 'property',
      resourceId: propertyId,
      metadata: { note: 'publication_status_updated', status: data.publication_status },
    });

    return NextResponse.json({ ok: true, publication: data });
  } catch (error) {
    console.error('Error in publication PATCH route:', error);
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
