import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { getCaseBasePath } from '@/lib/industries/caseConfig';
import { getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { getExpiryBadgeStyles, expiryStatusLabel, getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { formatPlazoDate } from '@/lib/format/date';
import { buildObservacionesModel, type ObservacionesModel, type CategoryState } from './data';
import styles from './Observaciones.module.css';

export const dynamic = 'force-dynamic';

function CategorySection({
  eyebrow,
  title,
  copy,
  state,
  emptyMessage,
  children,
  full,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  state: CategoryState<unknown>;
  emptyMessage: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section className={`${styles.section} ${full ? styles.sectionFull : ''}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.copy}>{copy}</p>

      {state.kind === 'unknown' ? (
        <p className={styles.sectionUnavailable}>
          Esta sección no está disponible porque la consulta no pudo completarse. No se interpreta como vacía ni como cero.
        </p>
      ) : state.total === 0 ? (
        <div className={`${styles.stateBanner} ${styles.stateEmpty}`} style={{ marginTop: 14 }} role="status">
          {emptyMessage}
        </div>
      ) : (
        <div className={styles.items}>{children}</div>
      )}
    </section>
  );
}

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
    agendaPlazosResult,
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('id, file_name, document_type, sensitivity_level, expires_at, case_id, file_mime_type, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_outputs')
      .select('id, document_id, output_type, result_json, case_id, created_at')
      .eq('organization_id', profile.organization_id)
      .in('output_type', ['document_analysis', 'case_summary'])
      .order('created_at', { ascending: false }),
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
    supabase
      .from('agenda_plazos')
      .select('id, titulo, fecha, detalle, categoria, case_id')
      .eq('organization_id', profile.organization_id),
  ]);

  const industry = normalizeIndustryType(organizationResult?.data?.industry_type ?? null);
  const terms = getIndustryTerms(industry);
  const casePath = getCaseBasePath(industry);
  const isFem = terms.expedientePlural.toLowerCase() === 'operaciones';

  if (!industry) {
    return (
      <AppShell>
        <div className={styles.stateBanner + ' ' + styles.stateError} role="alert">
          El rubro de la organización no está disponible o no es reconocido, por lo que las observaciones no pueden evaluarse.
        </div>
      </AppShell>
    );
  }

  const model = buildObservacionesModel(
    {
      documents: documentsResult.error ? null : (documentsResult.data ?? []) as any,
      aiOutputs: aiOutputsResult.error ? null : (aiOutputsResult.data ?? []) as any,
      cases: casesResult.error ? null : (casesResult.data ?? []) as any,
      checklistItems: checklistItemsResult.error ? null : (checklistItemsResult.data ?? []) as any,
      clients: clientsResult.error ? null : (clientsResult.data ?? []) as any,
      properties: propertiesResult.error ? null : (propertiesResult.data ?? []) as any,
      agendaPlazos: agendaPlazosResult.error ? null : (agendaPlazosResult.data ?? []) as any,
      industry,
    },
    new Date()
  );

  const indicators = [
    { label: 'Doc. sensibles', state: model.sensibles, tone: 'critical' },
    { label: 'Vencimientos', state: model.vencimientos, tone: 'warning' },
    { label: terms.observacionesIncompletosCard, state: model.incompletos, tone: 'warning' },
    { label: 'IA pendiente', state: model.iaPendientes, tone: 'info' },
    { label: 'Sin clasificar', state: model.sinClasificar, tone: 'neutral' },
    { label: terms.observacionesPlazosCard, state: model.plazos, tone: 'warning' },
  ];

  const indicatorValue = (state: CategoryState<unknown>) =>
    state.kind === 'ok' ? String(state.total) : '—';

  const allZero = model.queriesComplete && model.totalObservaciones === 0;

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className={styles.eyebrow}>Observaciones</p>
          <h2 className={styles.title} style={{ fontSize: 28 }}>
            Centro de atención operativa
          </h2>
          <p className={styles.copy}>{terms.observacionesSubtitulo}</p>
        </div>
      </div>

      {model.queriesComplete ? null : (
        <div className={`${styles.stateBanner} ${styles.statePartial}`} role="alert" style={{ marginBottom: 16 }}>
          Datos parciales: las consultas {model.failedDependencies.join(', ')} no pudieron completarse.
          Las secciones afectadas se muestran como no disponibles y el total no se presenta como cero.
        </div>
      )}

      <div className={styles.gridIndicators}>
        {indicators.map((indicator) => (
          <div key={indicator.label} className={`${styles.indicator} ${indicator.tone === 'critical' ? styles.critical : indicator.tone === 'warning' ? styles.warning : indicator.tone === 'info' ? styles.info : ''}`}>
            <p className={styles.indicatorLabel}>{indicator.label}</p>
            <p className={styles.indicatorValue}>{indicatorValue(indicator.state)}</p>
          </div>
        ))}
      </div>

      {allZero ? (
        <div className={`${styles.stateBanner} ${styles.stateOk}`} role="status">
          No hay observaciones pendientes entre las secciones consultadas. Este aviso solo corresponde a datos efectivamente disponibles; no garantiza ausencia de riesgos no evaluados.
        </div>
      ) : (
        <div className={styles.grid}>
          <CategorySection
            eyebrow="Sensibilidad"
            title="Documentos sensibles"
            copy="Archivos marcados con alta criticidad."
            state={model.sensibles}
            emptyMessage="Sin documentos sensibles."
          >
            {model.sensibles.kind === 'ok' ? model.sensibles.items.slice(0, 8).map((doc) => (
              <Link key={doc.id} href={`/documentos/${doc.id}`} className={styles.itemRow}>
                <div style={{ overflow: 'hidden' }}>
                  <p className={styles.itemTitle}>{doc.file_name}</p>
                  <p className={styles.itemMeta}>{getDocumentTypeLabel(doc.document_type)}</p>
                </div>
                <span className={`${styles.badge} ${styles.badgeCritical}`}>Sensible</span>
              </Link>
            )) : null}
            {model.sensibles.kind === 'ok' && model.sensibles.total > 8 ? (
              <Link href="/reportes?vista=documentos" className={styles.moreLink}>Ver reporte de sensibilidad ({model.sensibles.total})</Link>
            ) : null}
          </CategorySection>

          <CategorySection
            eyebrow="Vencimientos"
            title="Vencimientos a revisar"
            copy="Documentos próximos a vencer o vencidos."
            state={model.vencimientos}
            emptyMessage="Sin vencimientos próximos."
          >
            {model.vencimientos.kind === 'ok' ? model.vencimientos.items.slice(0, 8).map((doc) => {
              const status = getDocumentExpiryStatus(doc.expires_at);
              return (
                <Link key={doc.id} href={`/documentos/${doc.id}`} className={styles.itemRow}>
                  <div style={{ overflow: 'hidden' }}>
                    <p className={styles.itemTitle}>{doc.file_name}</p>
                    <p className={styles.itemMeta}>{formatPlazoDate(doc.expires_at)}</p>
                  </div>
                  <span className={`${styles.badge} ${getExpiryBadgeStyles(status)}`}>{expiryStatusLabel(status)}</span>
                </Link>
              );
            }) : null}
            {model.vencimientos.kind === 'ok' && model.vencimientos.total > 8 ? (
              <Link href="/reportes?vista=documentos" className={styles.moreLink}>Ver reporte de vencimientos ({model.vencimientos.total})</Link>
            ) : null}
          </CategorySection>

          <CategorySection
            eyebrow="Checklist"
            title={terms.observacionesIncompletosTitulo}
            copy="Checklist documental sugerido, aún sin completar."
            state={model.incompletos}
            emptyMessage={`Todos los ${terms.expedientePlural.toLowerCase()} están ${isFem ? 'completas' : 'completos'}.`}
          >
            {model.incompletos.kind === 'ok' ? model.incompletos.items.slice(0, 8).map((c) => (
              <Link key={c.id} href={`${casePath}/${c.id}`} className={styles.itemRow}>
                <div style={{ overflow: 'hidden' }}>
                  <p className={styles.itemTitle}>{c.title || terms.itemSinTitulo}</p>
                  {c.hasUnknown ? <p className={styles.itemMeta}>Incluye estados por revisar</p> : null}
                </div>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                  Sugeridos {c.total - c.fulfilled}/{c.total}
                </span>
              </Link>
            )) : null}
            {model.incompletos.kind === 'ok' && model.incompletos.total > 8 ? (
              <Link href={casePath} className={styles.moreLink}>
                Ver {isFem ? 'todas las' : 'todos los'} {terms.expedientePlural.toLowerCase()} ({model.incompletos.total})
              </Link>
            ) : null}
          </CategorySection>

          <CategorySection
            eyebrow="Análisis"
            title="Análisis IA pendientes"
            copy="Documentos que no han sido procesados por la IA."
            state={model.iaPendientes}
            emptyMessage="Análisis IA al día."
          >
            {model.iaPendientes.kind === 'ok' ? model.iaPendientes.items.slice(0, 8).map((doc) => {
              const isPdf = doc.file_mime_type === 'application/pdf';
              return (
                <Link key={doc.id} href={`/documentos/${doc.id}`} className={styles.itemRow}>
                  <div style={{ overflow: 'hidden' }}>
                    <p className={styles.itemTitle}>{doc.file_name}</p>
                    <p className={styles.itemMeta}>
                      Tipo: {getDocumentTypeLabel(doc.document_type) || 'Sin clasificar'} · IA pendiente
                    </p>
                  </div>
                  <span className={`${styles.badge} ${isPdf ? styles.badgeInfo : styles.badgeNeutral}`}>
                    {isPdf ? 'IA pendiente' : 'Solo PDF'}
                  </span>
                </Link>
              );
            }) : null}
            {model.iaPendientes.kind === 'ok' && model.iaPendientes.total > 8 ? (
              <Link href="/documentos?ia=pendientes" className={styles.moreLink}>Ver todos los pendientes ({model.iaPendientes.total})</Link>
            ) : null}
          </CategorySection>

          <CategorySection
            eyebrow="Clasificación"
            title="Documentos sin clasificar"
            copy="Documentos que no tienen un tipo asignado."
            state={model.sinClasificar}
            emptyMessage="Todos los documentos están clasificados."
            full
          >
            {model.sinClasificar.kind === 'ok' ? model.sinClasificar.items.slice(0, 8).map((doc) => (
              <Link key={doc.id} href={`/documentos/${doc.id}`} className={styles.itemRow}>
                <div style={{ overflow: 'hidden' }}>
                  <p className={styles.itemTitle}>{doc.file_name}</p>
                  <p className={styles.itemMeta}>Sin clasificar</p>
                </div>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>Sin clasificar</span>
              </Link>
            )) : null}
            {model.sinClasificar.kind === 'ok' && model.sinClasificar.total > 8 ? (
              <Link href="/documentos" className={styles.moreLink}>Ver todos los documentos ({model.sinClasificar.total})</Link>
            ) : null}
          </CategorySection>

          <CategorySection
            eyebrow="Plazos"
            title={terms.observacionesPlazosTitulo}
            copy={terms.observacionesPlazosDesc}
            state={model.plazos}
            emptyMessage={terms.observacionesPlazosVacio}
          >
            {model.plazos.kind === 'ok' ? model.plazos.items.slice(0, 8).map((item) => {
              const status = getDocumentExpiryStatus(item.fecha);
              return (
                <Link key={item.id} href={`${casePath}/${item.caseId}`} className={styles.itemRow}>
                  <div style={{ overflow: 'hidden' }}>
                    <p className={styles.itemTitle}>{item.title || terms.itemSinTitulo}</p>
                    <p className={styles.itemMeta}>{item.tipo} · {formatPlazoDate(item.fecha)}</p>
                  </div>
                  <span className={`${styles.badge} ${getExpiryBadgeStyles(status)}`}>{expiryStatusLabel(status)}</span>
                </Link>
              );
            }) : null}
            {model.plazos.kind === 'ok' && model.plazos.total > 8 ? (
              <Link href={casePath} className={styles.moreLink}>Ver todos ({model.plazos.total})</Link>
            ) : null}
          </CategorySection>

          {industry === 'inmobiliaria' ? (
            <>
              <CategorySection
                eyebrow="Clientes"
                title="Clientes sin seguimiento"
                copy="Sin movimientos en los últimos 15 días."
                state={model.clientesSinSeguimiento}
                emptyMessage="Todos los clientes tienen seguimiento reciente."
              >
                {model.clientesSinSeguimiento.kind === 'ok' ? model.clientesSinSeguimiento.items.map((item) => (
                  <Link key={item.id} href={`/clientes/${item.id}`} className={styles.itemRow}>
                    <div style={{ overflow: 'hidden' }}>
                      <p className={styles.itemTitle}>{item.name}</p>
                      <p className={styles.itemMeta}>
                        {item.days !== null ? `Último cambio hace más de ${item.days} días` : 'Fecha de cambio no disponible'}
                      </p>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeWarning}`}>+15 días</span>
                  </Link>
                )) : null}
                {model.clientesSinSeguimiento.kind === 'ok' && model.clientesSinSeguimiento.hasIndeterminate ? (
                  <p className={styles.partialNote}>Algunos clientes no se evaluaron por fecha de cambio ausente o no interpretable.</p>
                ) : null}
                {model.clientesSinSeguimiento.kind === 'ok' && model.clientesSinSeguimiento.total > 8 ? (
                  <Link href="/clientes" className={styles.moreLink}>Ver todos ({model.clientesSinSeguimiento.total})</Link>
                ) : null}
              </CategorySection>

              <CategorySection
                eyebrow="Propiedades"
                title="Propiedades sin movimiento"
                copy="Sin movimientos en los últimos 30 días."
                state={model.propiedadesSinMovimiento}
                emptyMessage="Todas las propiedades tienen movimientos recientes."
              >
                {model.propiedadesSinMovimiento.kind === 'ok' ? model.propiedadesSinMovimiento.items.map((item) => (
                  <Link key={item.id} href={`/propiedades/${item.id}`} className={styles.itemRow}>
                    <div style={{ overflow: 'hidden' }}>
                      <p className={styles.itemTitle}>{item.name}</p>
                      <p className={styles.itemMeta}>
                        {item.days !== null ? `Último cambio hace más de ${item.days} días` : 'Fecha de cambio no disponible'}
                      </p>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeWarning}`}>+30 días</span>
                  </Link>
                )) : null}
                {model.propiedadesSinMovimiento.kind === 'ok' && model.propiedadesSinMovimiento.hasIndeterminate ? (
                  <p className={styles.partialNote}>Algunas propiedades no se evaluaron por fecha de cambio ausente o no interpretable.</p>
                ) : null}
                {model.propiedadesSinMovimiento.kind === 'ok' && model.propiedadesSinMovimiento.total > 8 ? (
                  <Link href="/propiedades" className={styles.moreLink}>Ver todas ({model.propiedadesSinMovimiento.total})</Link>
                ) : null}
              </CategorySection>

              <CategorySection
                eyebrow="Reservas"
                title="Reservas por vencer"
                copy="Operaciones con reserva próxima a vencer."
                state={model.reservasPorVencer}
                emptyMessage="No hay reservas próximas a vencer."
                full
              >
                {model.reservasPorVencer.kind === 'ok' ? model.reservasPorVencer.items.slice(0, 8).map((item) => {
                  const status = getDocumentExpiryStatus(item.fecha);
                  return (
                    <Link key={item.id} href={`/operaciones/${item.id}`} className={styles.itemRow}>
                      <div style={{ overflow: 'hidden' }}>
                        <p className={styles.itemTitle}>{item.title || terms.itemSinTitulo}</p>
                        <p className={styles.itemMeta}>Fin de reserva: {formatPlazoDate(item.fecha)}</p>
                      </div>
                      <span className={`${styles.badge} ${getExpiryBadgeStyles(status)}`}>{expiryStatusLabel(status)}</span>
                    </Link>
                  );
                }) : null}
                {model.reservasPorVencer.kind === 'ok' && model.reservasPorVencer.total > 8 ? (
                  <Link href="/operaciones" className={styles.moreLink}>Ver todas ({model.reservasPorVencer.total})</Link>
                ) : null}
              </CategorySection>
            </>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

export type { ObservacionesModel };
