import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { agregarObservacion, subirDocumentoDerivado } from '../actions';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

interface Props { params: Promise<{ id: string }>; }

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
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
      <div className="space-y-6">
        <Link href="/recibidos" className="text-sm text-slate-400 hover:text-white">← Volver a Recibidos</Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Legajo derivado</p>
            <h1 className="text-2xl font-semibold text-white">{legajo?.title || derivacion.case_title || 'Legajo'}</h1>
            <p className="mt-1 text-sm text-slate-400">
              De: {derivacion.from_organization_name || 'Organización'} · Cliente: {legajo?.client_name || 'Sin cliente'}
            </p>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">Solo lectura</span>
        </div>

        {!legajo ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            No se pudo cargar el legajo. Puede que la derivación haya sido revocada.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
              <h2 className="text-sm font-semibold text-white">Datos del legajo</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Tipo</p><p className="text-sm text-slate-200">{legajo.case_type || 'Sin definir'}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Estado</p><p className="text-sm text-slate-200">{legajo.status || 'Sin definir'}</p></div>
                {fechaRelevante && <div><p className="text-xs uppercase tracking-wide text-slate-500">Fecha relevante</p><p className="text-sm text-slate-200">{fechaRelevante}</p></div>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
              <h2 className="text-sm font-semibold text-white">Documentos ({documentos.length})</h2>
              {documentos.length === 0 ? (
                <p className="text-sm text-slate-500">Este legajo no tiene documentos.</p>
              ) : (
                <ul className="space-y-2">
                  {documentos.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="text-sm text-white">{d.file_name}</p>
                        <p className="text-xs text-slate-400">{getDocumentTypeLabel(d.document_type)} · Sensibilidad: {sensitivityLabel(d.sensitivity_level)}</p>
                      </div>
                      <a href={`/recibidos/${derivacion.id}/documento/${d.id}`} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20">
                        Abrir documento →
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500">El archivo se abre en una pestaña nueva mediante un enlace temporal seguro.</p>
              <form action={subirDocumentoDerivado} className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <input type="hidden" name="derivation_id" value={derivacion.id} />
                <input
                  type="file"
                  name="file"
                  required
                  accept="application/pdf,image/jpeg,image/png"
                  className="text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
                />
                <FormSubmitButton label="Subir documento al legajo" loadingLabel="Subiendo..." />
              </form>
              <p className="mt-2 text-xs text-slate-500">
                Podés aportar documentos (PDF, JPG o PNG) al legajo compartido. También los verá la organización que te lo derivó.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
              <h2 className="text-sm font-semibold text-white">Análisis IA ({analisis.length})</h2>
              {analisis.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay análisis de IA en este legajo.</p>
              ) : (
                analisis.map((a) => {
                  const rj = (a.result_json ?? {}) as any;
                  const resumen = typeof rj.resumen === 'string' ? rj.resumen : '';
                  const datosClave = asArray(rj.datos_clave);
                  const alertas = asArray(rj.alertas);
                  const partes = asArray(rj.partes);
                  return (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <p className="text-xs text-slate-400">{a.document_id ? nombrePorDoc.get(a.document_id) || 'Documento' : 'Documento'}</p>
                      {resumen && <p className="text-sm text-slate-200">{resumen}</p>}
                      {partes.length > 0 && (<div><p className="text-xs font-semibold text-slate-400">Partes</p><ul className="list-disc pl-5 text-sm text-slate-300">{partes.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                      {datosClave.length > 0 && (<div><p className="text-xs font-semibold text-slate-400">Datos clave</p><ul className="list-disc pl-5 text-sm text-slate-300">{datosClave.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                      {alertas.length > 0 && (<div><p className="text-xs font-semibold text-rose-400">Alertas</p><ul className="list-disc pl-5 text-sm text-rose-300">{alertas.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
                    </div>
                  );
                })
              )}
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Observaciones de la escribanía</h2>
              <p className="mt-1 text-sm text-slate-400">
                Dejá notas sobre este legajo. Las verá la organización que te lo derivó.
              </p>

              <ul className="mt-4 space-y-3">
                {(observaciones ?? []).map((o) => (
                  <li key={o.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="whitespace-pre-wrap text-sm text-white">{o.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {o.author_org_name ?? 'Escribanía'} · {new Date(o.created_at).toLocaleString('es-AR')}
                    </p>
                  </li>
                ))}
                {(observaciones ?? []).length === 0 && (
                  <li className="text-sm text-slate-500">Todavía no hay observaciones.</li>
                )}
              </ul>

              <form action={agregarObservacion} className="mt-4 space-y-3">
                <input type="hidden" name="derivation_id" value={derivacion.id} />
                <input type="hidden" name="case_id" value={derivacion.case_id} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Escribí una observación para la inmobiliaria…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500"
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
