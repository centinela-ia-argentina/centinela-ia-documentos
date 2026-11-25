import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { agregarObservacion, subirDocumentoDerivado } from '../actions';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

interface Props { params: Promise<{ id: string }>; }

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' }).format(d);
}

function asArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? JSON.stringify(x) : String(x)))
    .filter(Boolean);
}

export default async function RecibidoDetallePage({ params }: Props) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const organizationIndustry = orgData?.industry_type || 'general';
  const terms = getIndustryTerms(organizationIndustry as any);

  // La derivacion: la RLS ya solo me deja ver las dirigidas a mi organizacion.
  const { data: derivacion } = await supabase
    .from('case_derivations')
    .select('id, case_id, from_organization_name, case_title, status, mensaje, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!derivacion || derivacion.status !== 'aceptada') {
    redirect('/recibidos');
  }

  // IMPORTANTE: el caso es de OTRA organizacion. NO filtrar por organization_id.
  // El acceso lo habilita la RLS de derivacion aceptada (has_accepted_derivation).
  const caseId = derivacion.case_id;

  const [caseResult, documentsResult, aiResult] = await Promise.all([
    supabase.from('cases').select('id, title, client_name, case_type, status, metadata, created_at').eq('id', caseId).maybeSingle(),
    supabase.from('documents').select('id, file_name, document_type, sensitivity_level, created_at').eq('case_id', caseId).order('created_at', { ascending: false }),
    supabase.from('ai_outputs').select('id, document_id, result_json, created_at').eq('case_id', caseId).eq('output_type', 'document_analysis').order('created_at', { ascending: false }),
  ]);

  const { data: observaciones } = await supabase
    .from('derivation_notes')
    .select('id, body, author_org_name, created_at')
    .eq('derivation_id', derivacion.id)
    .order('created_at', { ascending: true });

  const legajo = caseResult.data;
  const documentos = documentsResult.data ?? [];
  const analisis = aiResult.data ?? [];

  const nombrePorDoc = new Map<string, string>();
  for (const d of documentos) nombrePorDoc.set(d.id, d.file_name);

  const fechaRelevante = (legajo?.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1080px]">
        <Link href="/recibidos" className="text-sm text-[#626b73] hover:text-[#25272a]">← Volver a Recibidos</Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#626b73]">{terms.expedienteSingular} derivado</p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-.02em] text-[#25272a]">{legajo?.title || derivacion.case_title || terms.itemSinTitulo}</h1>
            <p className="mt-1 text-xs text-[#626b73]">
              De: {derivacion.from_organization_name || 'Organización'} · Cliente: {legajo?.client_name || 'Sin cliente'}
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full border border-[#d9d9d6] bg-white px-3 py-1 text-xs font-medium text-[#626b73]">
              Acceso colaborativo limitado
            </span>
            <p className="mt-1 text-[11px] text-[#8a8f94]">
              Visualización de antecedentes y carga de documentación
            </p>
          </div>
        </div>

        {!legajo ? (
          <div className="rounded-[10px] border border-[#d9d9d6] bg-white p-6 text-xs text-[#626b73]">
            No se pudo cargar el {terms.expedienteSingular.toLowerCase()}. Puede que la derivación haya sido revocada.
          </div>
        ) : (
          <>
            <div className="rounded-[10px] border border-[#d9d9d6] bg-white p-6 space-y-3">
              <h2 className="text-sm font-semibold text-[#25272a]">Datos del {terms.expedienteSingular.toLowerCase()}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#8a8f94]">Tipo</p><p className="text-sm text-[#25272a]">{legajo.case_type || 'Sin definir'}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#8a8f94]">Estado</p><p className="text-sm text-[#25272a]">{legajo.status || 'Sin definir'}</p></div>
                {fechaRelevante && <div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#8a8f94]">Fecha relevante</p><p className="text-sm text-[#25272a]">{fechaRelevante}</p></div>}
              </div>
            </div>

            <div className="rounded-[10px] border border-[#d9d9d6] bg-white p-6 space-y-3">
              <h2 className="text-sm font-semibold text-[#25272a]">Documentos ({documentos.length})</h2>
              {documentos.length === 0 ? (
                <p className="text-xs text-[#626b73]">Este {terms.expedienteSingular.toLowerCase()} no tiene documentos.</p>
              ) : (
                <ul className="space-y-2">
                  {documentos.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#e4e5e3] bg-[#fafaf9] p-3">
                      <div>
                        <p className="text-sm text-[#25272a]">{d.file_name}</p>
                        <p className="text-xs text-[#626b73]">{getDocumentTypeLabel(d.document_type)} · Sensibilidad: {sensitivityLabel(d.sensitivity_level)}</p>
                      </div>
                      <a href={`/recibidos/${derivacion.id}/documento/${d.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#92928f] bg-white px-3 py-1.5 text-xs font-semibold text-[#303030] hover:bg-[#f1f1ef]">
                        Abrir documento<ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-[#8a8f94]">El archivo se abre en una pestaña nueva mediante un enlace temporal seguro.</p>
              <form action={subirDocumentoDerivado} className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e4e5e3] pt-4">
                <input type="hidden" name="derivation_id" value={derivacion.id} />
                <input
                  type="file"
                  name="file"
                  required
                  accept="application/pdf,image/jpeg,image/png"
                  className="text-xs text-[#626b73] file:mr-3 file:rounded-[6px] file:border-0 file:bg-[#f1f1ef] file:px-3 file:py-1.5 file:text-[#303030]"
                />
                <FormSubmitButton label={`Subir documento al ${terms.expedienteSingular.toLowerCase()}`} loadingLabel="Subiendo..." />
              </form>
              <p className="mt-2 text-xs text-[#8a8f94]">
                Podés aportar documentos (PDF, JPG o PNG) al {terms.expedienteSingular.toLowerCase()} compartido. También los verá la organización que te lo derivó.
              </p>
            </div>

            <div className="rounded-[10px] border border-[#d9d9d6] bg-white p-6 space-y-3">
              <h2 className="text-sm font-semibold text-[#25272a]">Análisis IA ({analisis.length})</h2>
              {analisis.length === 0 ? (
                <p className="text-xs text-[#626b73]">Todavía no hay análisis de IA en este {terms.expedienteSingular.toLowerCase()}.</p>
              ) : (
                analisis.map((a) => {
                  const rj = (a.result_json ?? {}) as any;
                  const resumen = typeof rj.resumen === 'string' ? rj.resumen : '';
                  const datosClave = asArray(rj.datos_clave);
                  const alertas = asArray(rj.alertas);
                  const partes = asArray(rj.partes);
                  return (
                    <div key={a.id} className="rounded-[10px] border border-[#e4e5e3] bg-[#fafaf9] p-4 space-y-2">
                      <p className="text-xs text-[#626b73]">{a.document_id ? nombrePorDoc.get(a.document_id) || 'Documento' : 'Documento'}</p>
                      {resumen && <p className="text-sm text-[#25272a]">{resumen}</p>}
                      {partes.length > 0 && (<div><p className="text-xs font-semibold text-[#626b73]">Partes</p><ul className="list-disc pl-5 text-sm text-[#40403e]">{partes.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                      {datosClave.length > 0 && (<div><p className="text-xs font-semibold text-[#626b73]">Datos clave</p><ul className="list-disc pl-5 text-sm text-[#40403e]">{datosClave.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                      {alertas.length > 0 && (<div><p className="text-xs font-semibold text-[#a63d33]">Alertas</p><ul className="list-disc pl-5 text-sm text-[#a63d33]">{alertas.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                    </div>
                  );
                })
              )}
            </div>

            <section className="rounded-[10px] border border-[#d9d9d6] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#25272a]">Observaciones {organizationIndustry === 'escribania' ? 'de la escribanía' : 'de la organización'}</h2>
              <p className="mt-1 text-xs text-[#626b73]">
                Dejá notas sobre este {terms.expedienteSingular.toLowerCase()}. Las verá la organización que te lo derivó.
              </p>

              <ul className="mt-4 space-y-3">
                {(observaciones ?? []).map((o) => (
                  <li key={o.id} className="rounded-[10px] border border-[#e4e5e3] bg-[#fafaf9] p-3">
                    <p className="whitespace-pre-wrap text-sm text-[#25272a]">{o.body}</p>
                    <p className="mt-1 text-xs text-[#8a8f94]">
                      {o.author_org_name ?? (organizationIndustry === 'escribania' ? 'Escribanía' : 'Organización')} · {new Date(o.created_at).toLocaleString('es-AR', { timeZone: 'America/Buenos_Aires' })}
                    </p>
                  </li>
                ))}
                {(observaciones ?? []).length === 0 && (
                  <li className="text-xs text-[#626b73]">Todavía no hay observaciones.</li>
                )}
              </ul>

              <form action={agregarObservacion} className="mt-4 space-y-3">
                <input type="hidden" name="derivation_id" value={derivacion.id} />
                <input type="hidden" name="case_id" value={derivacion.case_id} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder={`Escribí una observación para ${derivacion.from_organization_name || 'la otra organización'}…`}
                  className="w-full rounded-[8px] border border-[#d9d9d6] bg-white p-3 text-sm text-[#25272a] placeholder:text-[#8a8f94]"
                />
                <FormSubmitButton label="Agregar observación" loadingLabel="Agregando..." />
              </form>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
