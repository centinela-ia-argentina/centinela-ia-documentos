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

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            Documentos
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-950">
            Subir documento
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            El archivo se guardará en storage privado y quedará asociado a tu organización.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <UploadClient
          cases={cases ?? []}
          documentTypes={documentTypes}
          initialCaseId={selectedCaseId}
        />
      </div>
    </AppShell>
  );
}
