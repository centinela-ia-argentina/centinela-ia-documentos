import { CaretDown, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import { AppButton } from '@/components/ui/AppButton';
import { SelectField } from '@/components/ui/SelectField';
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
        const monoValue = field.key === 'numero_expediente' || field.key === 'valor_operacion' || field.key === 'registro_protocolo' || field.key === 'referencia_interna';
        return <div key={field.key}><dt>{field.label}</dt><dd className={monoValue ? styles.monoValue : undefined}>{displayValue}</dd></div>;
      })}
    </dl>
    <details open={visibleFields.length === 0} className={styles.editor}>
      <summary><span><PencilSimple size={16} aria-hidden="true" />{labels.edit}</span><CaretDown size={16} aria-hidden="true" /></summary>
      <form action={updateAction} className={styles.form}>
        <input type="hidden" name="case_id" value={caseId} />
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-status`}>Estado</label>
          <SelectField name="status" label="Estado" defaultValue={status} placeholder="Seleccionar" options={statusOptions.map(option => ({ value: option.value, label: option.label }))} />
        </div>
        {fields.length > 0 ? <div className={styles.fields}>{fields.map(field => <div key={field.key} className={styles.field}>
          <label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</label>
          {field.type === 'select' ? <SelectField name={`case_metadata.${field.key}`} label={field.label} defaultValue={metadataValue(metadata, field.key)} placeholder="Sin definir" options={[{ value: '', label: 'Sin definir' }, ...(field.options ?? []).map(option => ({ value: option, label: option }))]} /> : <input id={`${idPrefix}-${field.key}`} name={`case_metadata.${field.key}`} type={field.type} defaultValue={metadataValue(metadata, field.key)} />}
        </div>)}</div> : null}
        <AppButton type="submit">{labels.update}</AppButton>
      </form>
    </details>
  </section>;
}
