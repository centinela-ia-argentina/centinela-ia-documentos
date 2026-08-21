import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus, expiryStatusLabel, getExpiryBadgeStyles, getDaysUntilExpiry } from '@/lib/documents/expiry';
import { getDocumentTypeLabel, normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { isSensitiveDocument } from '@/lib/documents/sensitivity';
import { formatPlazoDate } from '@/lib/format/date';
import { MotionCard } from '@/components/ui/MotionCard';


export default async function ObservacionesPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const [
    documentsResult,
    aiOutputsResult,
    casesResult,
    checklistItemsResult,
    organizationResult,
    clientsResult,
    propertiesResult,
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('id, file_name, document_type, sensitivity_level, expires_at, case_id, file_mime_type, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),

    supabase
      .from('ai_outputs')
      .select('document_id')
      .eq('organization_id', profile.organization_id)
      .eq('output_type', 'document_analysis'),

    supabase
      .from('cases')
      .select('id, title, status, metadata')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado')
      .order('created_at', { ascending: false }),

    supabase
      .from('checklist_items')
      .select('status, checklists!inner(case_id)')
      .eq('checklists.organization_id', profile.organization_id),

    supabase
      .from('organizations')
      .select('industry_type')
      .eq('id', profile.organization_id)
      .maybeSingle(),

    supabase
      .from('clients')
      .select('id, name, updated_at, status')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'inactivo')
      .order('updated_at', { ascending: true }),

    supabase
      .from('properties')
      .select('id, name, updated_at, status')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'vendida')
      .neq('status', 'alquilada')
      .order('updated_at', { ascending: true }),
  ]);

  const documents = documentsResult.data ?? [];
  const aiOutputs = aiOutputsResult.data ?? [];
  const cases = casesResult.data ?? [];
  const checklistItems = checklistItemsResult.data ?? [];
  const clients = clientsResult?.data ?? [];
  const properties = propertiesResult?.data ?? [];

  const industry = normalizeIndustryType(organizationResult?.data?.industry_type);
  const terms = getIndustryTerms(industry);
  const isFem = terms.expedientePlural.toLowerCase() === 'operaciones';

  const caseTitleMap = new Map(cases.map(c => [c.id, c.title || terms.itemSinTitulo]));

  // 1. Documentos sensibles
  const sensiblesAll = documents.filter((doc) => isSensitiveDocument(doc.sensitivity_level));
  const sensibles = sensiblesAll.slice(0, 8);

  // 2. Vencimientos a revisar
  const vencimientosAll = documents.filter((doc) => {
    if (!doc.expires_at) return false;
    const status = getDocumentExpiryStatus(doc.expires_at);
    return status === 'por_vencer' || status === 'vencido';
  }).sort((a, b) => {
    const daysA = getDaysUntilExpiry(a.expires_at!) ?? 0;
    const daysB = getDaysUntilExpiry(b.expires_at!) ?? 0;
    return daysA - daysB;
  });
  const vencimientos = vencimientosAll.slice(0, 8);

  // 3. Expedientes incompletos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusesByCase = checklistItems.reduce((acc: Record<string, string[]>, item: any) => {
    const caseId = item.checklists.case_id;
    if (!acc[caseId]) acc[caseId] = [];
    acc[caseId].push(item.status);
    return acc;
  }, {});

  const incompletosAll = cases.map((c) => {
    const statuses = statusesByCase[c.id] || [];
    const summary = summarizeChecklistStatuses(statuses);
    return { ...c, summary };
  }).filter((c) => !c.summary.isComplete && c.summary.total > 0);
  const incompletos = incompletosAll.slice(0, 8);

  // 4. Análisis IA pendientes
  const analyzedDocIds = new Set(aiOutputs.map(o => String(o.document_id)));
  const iaPendientesAll = documents.filter((doc) => !analyzedDocIds.has(String(doc.id)));
  const iaPendientes = iaPendientesAll.slice(0, 8);

  // 5. Documentos sin clasificar
  const sinClasificarAll = documents.filter((doc) => !doc.document_type || doc.document_type.trim() === '');
  const sinClasificar = sinClasificarAll.slice(0, 8);

  // 6. Plazos procesales / fechas clave
  const plazosAll = cases
    .map((c) => {
      const metadata = c.metadata as Record<string, unknown> | null;
      const fecha = (metadata?.fecha_relevante as string | undefined)?.trim();
      const tipo = (metadata?.tipo_fecha as string | undefined)?.trim() || 'Fecha de operación';
      return fecha ? { id: c.id, title: c.title, fecha, tipo } : null;
    })
    .filter((c): c is { id: string; title: string; fecha: string; tipo: string } => {
      if (!c) return false;
      const status = getDocumentExpiryStatus(c.fecha);
      return status === 'por_vencer' || status === 'vencido';
    })
    .sort((a, b) => (getDaysUntilExpiry(a.fecha) ?? 0) - (getDaysUntilExpiry(b.fecha) ?? 0));
  const plazos = plazosAll.slice(0, 8);

  const now = new Date();
  
  // 7. Clientes sin seguimiento
  const clientesSinSeguimientoAll = clients.filter(c => {
    const lastUpdate = new Date(c.updated_at);
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 15;
  });
  const clientesSinSeguimiento = clientesSinSeguimientoAll.slice(0, 8);

  // 8. Propiedades sin movimiento
  const propiedadesSinMovimientoAll = properties.filter(p => {
    if (p.status !== 'disponible') return false;
    const lastUpdate = new Date(p.updated_at);
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  });
  const propiedadesSinMovimiento = propiedadesSinMovimientoAll.slice(0, 8);

  // 9. Reservas por vencer (Inmobiliaria)
  const reservasPorVencerAll = cases.map(c => {
    const meta = c.metadata as Record<string, unknown> | null;
    const fecha = (meta?.fecha_fin_reserva as string | undefined)?.trim();
    return fecha ? { id: c.id, title: c.title, fecha, tipo: 'Reserva' } : null;
  }).filter((c): c is { id: string; title: string; fecha: string; tipo: string } => {
    if (!c) return false;
    const status = getDocumentExpiryStatus(c.fecha);
    return status === 'por_vencer' || status === 'vencido';
  }).sort((a, b) => (getDaysUntilExpiry(a.fecha) ?? 0) - (getDaysUntilExpiry(b.fecha) ?? 0));
  const reservasPorVencer = reservasPorVencerAll.slice(0, 8);

  const totalObservaciones = sensiblesAll.length + vencimientosAll.length + incompletosAll.length + iaPendientesAll.length + sinClasificarAll.length + plazosAll.length + (industry === 'inmobiliaria' ? (clientesSinSeguimientoAll.length + propiedadesSinMovimientoAll.length + reservasPorVencerAll.length) : 0);

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Observaciones
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Centro de atención operativa
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {terms.observacionesSubtitulo}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MotionCard index={0} className="p-5">
          <p className="text-sm font-semibold text-slate-400">Doc. sensibles</p>
          <p className={`mt-2 text-3xl font-bold ${sensiblesAll.length > 0 ? 'text-rose-400' : 'text-white'}`}>
            {sensiblesAll.length}
          </p>
        </MotionCard>
        <MotionCard index={1} className="p-5">
          <p className="text-sm font-semibold text-slate-400">Vencimientos</p>
          <p className={`mt-2 text-3xl font-bold ${vencimientosAll.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {vencimientosAll.length}
          </p>
        </MotionCard>
        <MotionCard index={2} className="p-5">
          <p className="text-sm font-semibold text-slate-400">{terms.observacionesIncompletosCard}</p>
          <p className={`mt-2 text-3xl font-bold ${incompletosAll.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {incompletosAll.length}
          </p>
        </MotionCard>
        <MotionCard index={3} className="p-5">
          <p className="text-sm font-semibold text-slate-400">IA pendiente</p>
          <p className={`mt-2 text-3xl font-bold ${iaPendientesAll.length > 0 ? 'text-cyan-400' : 'text-white'}`}>
            {iaPendientesAll.length}
          </p>
        </MotionCard>
        <MotionCard index={4} className="p-5">
          <p className="text-sm font-semibold text-slate-400">Sin clasificar</p>
          <p className={`mt-2 text-3xl font-bold ${sinClasificarAll.length > 0 ? 'text-slate-300' : 'text-white'}`}>
            {sinClasificarAll.length}
          </p>
        </MotionCard>
        <MotionCard index={5} className="p-5">
          <p className="text-sm font-semibold text-slate-400">{terms.observacionesPlazosCard}</p>
          <p className={`mt-2 text-3xl font-bold ${plazosAll.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {plazosAll.length}
          </p>
        </MotionCard>
      </div>

      {totalObservaciones === 0 ? (
        <MotionCard index={6} className="border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
          <p className="text-lg font-bold text-emerald-400">No hay observaciones pendientes. Todo en orden. ✅</p>
          <p className="mt-2 text-sm text-emerald-200/70">El entorno controlado no detecta tareas operativas críticas en este momento.</p>
        </MotionCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* 1. Documentos sensibles */}
          <MotionCard index={6} className="p-6">
            <h3 className="text-lg font-bold text-white">Documentos sensibles</h3>
            <p className="mt-1 text-sm text-slate-400">Archivos marcados con alta criticidad.</p>
            <div className="mt-4 space-y-3">
              {sensibles.length > 0 ? sensibles.map((doc) => (
                <Link key={doc.id} href={`/documentos/${doc.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                  <div className="overflow-hidden">
                    <p className="truncate font-bold text-slate-200">{doc.file_name}</p>
                    <p className="truncate text-xs text-slate-400">{getDocumentTypeLabel(doc.document_type)}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs font-bold text-rose-400">Sensible</span>
                    <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                  </div>
                </Link>
              )) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Sin documentos sensibles.</div>
              )}
              {sensiblesAll.length > 8 && <Link href="/reportes?vista=documentos" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver reporte de sensibilidad</Link>}
            </div>
          </MotionCard>


          {/* 2. Vencimientos a revisar */}
          <MotionCard index={7} className="p-6">
            <h3 className="text-lg font-bold text-white">Vencimientos a revisar</h3>
            <p className="mt-1 text-sm text-slate-400">Documentos próximos a vencer o vencidos.</p>
            <div className="mt-4 space-y-3">
              {vencimientos.length > 0 ? vencimientos.map((doc) => {
                const status = getDocumentExpiryStatus(doc.expires_at!);
                const badgeStyles = getExpiryBadgeStyles(status);
                const label = expiryStatusLabel(status);
                return (
                  <Link key={doc.id} href={`/documentos/${doc.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                    <div className="overflow-hidden">
                      <p className="truncate font-bold text-slate-200">{doc.file_name}</p>
                      <p className="truncate text-xs text-slate-400">{formatPlazoDate(doc.expires_at)}</p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeStyles}`}>{label}</span>
                      <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Sin vencimientos próximos.</div>
              )}
              {vencimientosAll.length > 8 && <Link href="/reportes?vista=documentos" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver reporte de vencimientos</Link>}
            </div>
          </MotionCard>

          {/* 3. Expedientes incompletos */}
          <MotionCard index={8} className="p-6">
            <h3 className="text-lg font-bold text-white">{terms.observacionesIncompletosTitulo}</h3>
            <p className="mt-1 text-sm text-slate-400">Checklist documental sugerido, aún sin completar.</p>
            <div className="mt-4 space-y-3">
              {incompletos.length > 0 ? incompletos.map((c) => (
                <Link key={c.id} href={`/expedientes/${c.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                  <div className="overflow-hidden">
                    <p className="truncate font-bold text-slate-200">{c.title || terms.itemSinTitulo}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">
                      Sugeridos {c.summary.total - c.summary.missing}/{c.summary.total}
                    </span>
                    <span className="text-xs font-semibold text-cyan-400">Completar ›</span>
                  </div>
                </Link>
              )) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Todos los {terms.expedientePlural.toLowerCase()} están {isFem ? 'completas' : 'completos'}.</div>
              )}
              {incompletosAll.length > 8 && <Link href="/expedientes" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver {isFem ? 'todas las' : 'todos los'} {terms.expedientePlural.toLowerCase()}</Link>}
            </div>
          </MotionCard>

          {/* 4. Análisis IA pendientes */}
          <div id="analisis-ia-pendientes">
            <MotionCard index={9} className="p-6 h-full">
            <h3 className="text-lg font-bold text-white">Análisis IA pendientes</h3>
            <p className="mt-1 text-sm text-slate-400">Documentos que no han sido procesados por la IA.</p>
            <div className="mt-4 space-y-3">
              {iaPendientes.length > 0 ? iaPendientes.map((doc) => {
                const isPdf = doc.file_mime_type === 'application/pdf';
                return (
                  <Link key={doc.id} href={`/documentos/${doc.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                    <div className="overflow-hidden">
                      <p className="truncate font-bold text-slate-200">{doc.file_name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {doc.case_id && caseTitleMap.has(doc.case_id) ? `${caseTitleMap.get(doc.case_id)} · ` : 'Sin operación asociada · '}
                        Tipo: {getDocumentTypeLabel(doc.document_type) || 'Sin clasificar'} · IA pendiente
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      {isPdf ? (
                        <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-xs font-bold text-cyan-400">IA pendiente</span>
                      ) : (
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">Solo PDF</span>
                      )}
                      <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Análisis IA al día.</div>
              )}
              {iaPendientesAll.length > 8 && <Link href="/documentos?ia=pendientes" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todos los pendientes ({iaPendientesAll.length})</Link>}
            </div>
          </MotionCard>
          </div>

          {/* 5. Documentos sin clasificar */}
          <MotionCard index={10} className="p-6 xl:col-span-2">
            <h3 className="text-lg font-bold text-white">Documentos sin clasificar</h3>
            <p className="mt-1 text-sm text-slate-400">Documentos que no tienen un tipo asignado.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sinClasificar.length > 0 ? sinClasificar.map((doc) => (
                <Link key={doc.id} href={`/documentos/${doc.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                  <div className="overflow-hidden">
                    <p className="truncate font-bold text-slate-200">{doc.file_name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {doc.case_id && caseTitleMap.has(doc.case_id) ? `${caseTitleMap.get(doc.case_id)} · ` : 'Sin operación asociada · '}
                      Sin clasificar · {analyzedDocIds.has(String(doc.id)) ? 'IA completada' : 'IA pendiente'}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">Sin clasificar</span>
                    <span className="text-xs font-semibold text-cyan-400">Abrir para clasificar ›</span>
                  </div>
                </Link>
              )) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70 sm:col-span-2">Todos los documentos están clasificados.</div>
              )}
            </div>
            {sinClasificarAll.length > 8 && <Link href="/documentos" className="mt-3 block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todos los documentos</Link>}
          </MotionCard>

          {/* 6. Plazos procesales / fechas clave */}
          <MotionCard index={11} className="p-6">
            <h3 className="text-lg font-bold text-white">{terms.observacionesPlazosTitulo}</h3>
            <p className="mt-1 text-sm text-slate-400">{terms.observacionesPlazosDesc}</p>
            <div className="mt-4 space-y-3">
              {plazos.length > 0 ? plazos.map((item) => {
                const status = getDocumentExpiryStatus(item.fecha);
                const badgeStyles = getExpiryBadgeStyles(status);
                const label = expiryStatusLabel(status);
                return (
                  <Link key={item.id} href={`/expedientes/${item.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                    <div className="overflow-hidden">
                      <p className="truncate font-bold text-slate-200">{item.title || terms.itemSinTitulo}</p>
                      <p className="truncate text-xs text-slate-400">{item.tipo} · {formatPlazoDate(item.fecha)}</p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeStyles}`}>{label}</span>
                      <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                    </div>
                  </Link>
                );
              }) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">{terms.observacionesPlazosVacio}</div>
              )}
              {plazosAll.length > 8 && <Link href="/expedientes" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todos ({plazosAll.length})</Link>}
            </div>
          </MotionCard>

          {industry === 'inmobiliaria' && (
            <>
              {/* 7. Clientes sin seguimiento */}
              <MotionCard index={12} className="p-6">
                <h3 className="text-lg font-bold text-white">Clientes sin seguimiento</h3>
                <p className="mt-1 text-sm text-slate-400">Sin movimientos en los últimos 15 días.</p>
                <div className="mt-4 space-y-3">
                  {clientesSinSeguimiento.length > 0 ? clientesSinSeguimiento.map((item) => (
                    <Link key={item.id} href={`/clientes/${item.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                      <div className="overflow-hidden">
                        <p className="truncate font-bold text-slate-200">{item.name}</p>
                        <p className="truncate text-xs text-slate-400">Último cambio: {formatPlazoDate(item.updated_at)}</p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400">+15 días</span>
                        <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                      </div>
                    </Link>
                  )) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Todos los clientes tienen seguimiento reciente.</div>
                  )}
                  {clientesSinSeguimientoAll.length > 8 && <Link href="/clientes" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todos ({clientesSinSeguimientoAll.length})</Link>}
                </div>
              </MotionCard>

              {/* 8. Propiedades sin movimiento */}
              <MotionCard index={13} className="p-6">
                <h3 className="text-lg font-bold text-white">Propiedades sin movimiento</h3>
                <p className="mt-1 text-sm text-slate-400">Sin movimientos en los últimos 30 días.</p>
                <div className="mt-4 space-y-3">
                  {propiedadesSinMovimiento.length > 0 ? propiedadesSinMovimiento.map((item) => (
                    <Link key={item.id} href={`/propiedades/${item.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                      <div className="overflow-hidden">
                        <p className="truncate font-bold text-slate-200">{item.name}</p>
                        <p className="truncate text-xs text-slate-400">Último cambio: {formatPlazoDate(item.updated_at)}</p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400">+30 días</span>
                        <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                      </div>
                    </Link>
                  )) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70">Todas las propiedades tienen movimientos recientes.</div>
                  )}
                  {propiedadesSinMovimientoAll.length > 8 && <Link href="/propiedades" className="block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todas ({propiedadesSinMovimientoAll.length})</Link>}
                </div>
              </MotionCard>

              {/* 9. Reservas por vencer */}
              <MotionCard index={14} className="p-6 xl:col-span-2">
                <h3 className="text-lg font-bold text-white">Reservas por vencer</h3>
                <p className="mt-1 text-sm text-slate-400">Operaciones con reserva próxima a vencer.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {reservasPorVencer.length > 0 ? reservasPorVencer.map((item) => {
                    const status = getDocumentExpiryStatus(item.fecha);
                    const badgeStyles = getExpiryBadgeStyles(status);
                    const label = expiryStatusLabel(status);
                    return (
                      <Link key={item.id} href={`/expedientes/${item.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer transition hover:bg-white/[0.04]">
                        <div className="overflow-hidden">
                          <p className="truncate font-bold text-slate-200">{item.title || terms.itemSinTitulo}</p>
                          <p className="truncate text-xs text-slate-400">Fin de reserva: {formatPlazoDate(item.fecha)}</p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeStyles}`}>{label}</span>
                          <span className="text-xs font-semibold text-cyan-400">Revisar ›</span>
                        </div>
                      </Link>
                    );
                  }) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200/70 sm:col-span-2">No hay reservas próximas a vencer.</div>
                  )}
                </div>
                {reservasPorVencerAll.length > 8 && <Link href="/expedientes" className="mt-3 block text-sm font-bold text-cyan-400 hover:text-cyan-300">Ver todas ({reservasPorVencerAll.length})</Link>}
              </MotionCard>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
