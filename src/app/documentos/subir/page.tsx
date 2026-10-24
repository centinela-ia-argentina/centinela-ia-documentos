import Link from 'next/link';
import styles from './Upload.module.css';
import { canUploadDocument, isUserRole } from '@/lib/permissions/roles';
import { getCaseBasePath } from '@/lib/industries/caseConfig';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import {
  getDocumentTypes,
  normalizeIndustryType,
} from '@/lib/industries/documentTypes';
import { UploadClient } from './UploadClient';

interface UploadDocumentPageProps {
  searchParams: Promise<{ case?: string; error?: string }>;
}

function getErrorMessage(error?: string) {
  const messages: Record<string, string> = {
    missing_file: 'Seleccioná un archivo.',
    invalid_type: 'Tipo de archivo no permitido.',
    file_too_large: 'El archivo supera el tamaño máximo permitido.',
    invalid_case: 'El expediente seleccionado no es válido.',
    upload_failed: 'No se pudo subir el archivo.',
    metadata_failed: 'El archivo subió, pero no se pudieron guardar los metadatos.',
  };

  return error ? messages[error] : null;
}

export default async function UploadDocumentPage({
  searchParams,
}: UploadDocumentPageProps) {
  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);
  const selectedCaseId = typeof params.case === 'string' ? params.case : '';

  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const { data: cases } = await supabase
    .from('cases')
    .select('id, title')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const documentTypes = getDocumentTypes(
    normalizeIndustryType(organization?.industry_type)
  );

  const allowed = isUserRole(profile.role) && canUploadDocument(profile.role);
  const industry = normalizeIndustryType(organization?.industry_type);
  const back = selectedCaseId ? `${getCaseBasePath(industry)}/${selectedCaseId}?tab=documentos` : '/documentos';
  return <AppShell><section className={styles.root} aria-labelledby="uploadTitle">
    <nav className={styles.uploadCrumb} aria-label="Ubicación"><Link href={back}>← {selectedCaseId ? 'Documentos de la ficha' : 'Documentos'}</Link><span aria-hidden="true">›</span><span>Subir documento</span></nav>
    <header className={styles.uploadHead}><p className={styles.eyebrow}>BÓVEDA · CARGA DE ARCHIVOS</p><h1 id="uploadTitle">Subir documento</h1><p>Seleccioná los archivos y revisá los datos que se aplicarán a la carga.</p></header>
    {errorMessage && <div role="alert" className={styles.uploadSelectionAlert}>{errorMessage}</div>}
    {allowed ? <UploadClient cases={cases ?? []} documentTypes={documentTypes} initialCaseId={selectedCaseId} industry={industry}/> : <section className={styles.uploadPermission}><h2>La carga no está disponible para este rol</h2><p>Administrador y Operador pueden subir documentos.</p><Link href={back}>Volver a los documentos</Link></section>}
  </section></AppShell>;
}
