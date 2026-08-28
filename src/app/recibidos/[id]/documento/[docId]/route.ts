import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const { user, profile } = await getUserProfile();
  if (!user || !profile) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const supabase = await createClient();

  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('id, case_id, status, to_organization_id')
    .eq('id', id)
    .maybeSingle();

  if (!derivacion || derivacion.status !== 'aceptada' || derivacion.to_organization_id !== profile.organization_id) {
    return NextResponse.redirect(new URL('/recibidos', req.url));
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, case_id')
    .eq('id', docId)
    .eq('case_id', derivacion.case_id)
    .maybeSingle();

  if (!doc || !doc.file_path) {
    return NextResponse.redirect(new URL(`/recibidos/${id}?error=documento`, req.url));
  }

  const { data: signed, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_path, 120);

  if (error || !signed?.signedUrl) {
    return NextResponse.redirect(new URL(`/recibidos/${id}?error=descarga`, req.url));
  }

  return NextResponse.redirect(signed.signedUrl);
}
