import { CaretDown, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import { AppButton } from '@/components/ui/AppButton';
import type { CaseFieldDef, CaseStatusDef } from '@/lib/industries/caseConfig';
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/industries/caseConfig';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getDocumentExpiryStatus, expiryStatusLabel, getDaysUntilExpiry } from '@/lib/documents/expiry';
import { formatPlazoDate } from '@/lib/format/date';
import type { CaseRecord } from '@/types/case';
import styles from './RecordFacts.module.css';

export type RecordFormAction = (formData: FormData) => void | Promise<void>;
function metadataValue(metadata: CaseRecord['metadata'], key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

/** Presentation only. Fields/status options/visibility come from the real route;
 * the native details keeps the mounted form and its unsaved values when folded. */
export function CaseFacts({ caseId, caseType, status, industry, metadata, visibleFields, fields, statusOptions, labels, updateAction }: {
  caseId: string; caseType: CaseRecord['case_type']; status: string; industry: IndustryType; metadata: CaseRecord['metadata'];
  visibleFields: CaseFieldDef[]; fields: CaseFieldDef[]; statusOptions: CaseStatusDef[];
  labels: { title: string; edit: string; update: string }; updateAction: RecordFormAction;
}) {
  const idPrefix = `record-${caseId}`;
  return <section className={styles.data} aria-label={labels.title}>
    <h3>{labels.title}</h3>
    <dl className={styles.factsGrid}>
      <div><dt>Tipo</dt><dd>{getCaseTypeLabel(caseType)}</dd></div>
      <div><dt>Estado</dt><dd>{getCaseStatusLabel(status, industry)}</dd></div>
      {visibleFields.map(field => {
        const value = metadataValue(metadata, field.key);
        if (field.key === 'fecha_relevante' && value) {
          const expiry = getDocumentExpiryStatus(value);
          const days = getDaysUntilExpiry(value) ?? 0;
          return <div key={field.key}><dt>{field.label}</dt><dd className={styles.dateValue}>
            <span>{formatPlazoDate(value)}</span>
            <span className={`${styles.badge} ${expiry === 'vencido' ? styles.danger : expiry === 'por_vencer' ? styles.warning : styles.neutral}`}>{expiryStatusLabel(expiry)}</span>
            <small>{days >= 0 ? `(faltan ${days} días)` : `(vencido hace ${Math.abs(days)} días)`}</small>
          </dd></div>;
        }
        const displayValue = field.key === 'moneda_operacion' && !value ? 'Sin definir' : value;
        return <div key={field.key}><dt>{field.label}</dt><dd>{displayValue}</dd></div>;
      })}
    </dl>
    <details open={visibleFields.length === 0} className={styles.editor}>
      <summary><span><PencilSimple size={16} aria-hidden="true" />{labels.edit}</span><CaretDown size={16} aria-hidden="true" /></summary>
      <form action={updateAction} className={styles.form}>
        <input type="hidden" name="case_id" value={caseId} />
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-status`}>Estado</label>
          <select id={`${idPrefix}-status`} name="status" defaultValue={status}>
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {fields.length > 0 ? <div className={styles.fields}>{fields.map(field => <div key={field.key} className={styles.field}>
          <label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</label>
          {field.type === 'select' ? <select id={`${idPrefix}-${field.key}`} name={`case_metadata.${field.key}`} defaultValue={metadataValue(metadata, field.key)}>
            <option value="">Sin definir</option>
            {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
          </select> : <input id={`${idPrefix}-${field.key}`} name={`case_metadata.${field.key}`} type={field.type} defaultValue={metadataValue(metadata, field.key)} />}
        </div>)}</div> : null}
        <AppButton type="submit">{labels.update}</AppButton>
      </form>
    </details>
  </section>;
}
