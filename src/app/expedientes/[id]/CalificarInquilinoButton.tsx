'use client';

import styles from './IndustryTools.module.css';
import { useFormStatus } from 'react-dom';
import { SelectField } from '@/components/ui/SelectField';
import { calificarInquilinoExpediente } from '../actions';

function SubmitButton({ yaGenerada }: { yaGenerada: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.action}
    >
      {pending ? 'Calificando…' : yaGenerada ? 'Recalificar inquilino y garantía' : 'Calificar inquilino y garantía (IA)'}
    </button>
  );
}

export function CalificarInquilinoButton({ caseId, yaGenerada }: { caseId: string; yaGenerada: boolean }) {
  return (
    <form action={calificarInquilinoExpediente} className={styles.rentalForm}>
      <input type="hidden" name="caseId" value={caseId} />
      <label htmlFor={`prescore-${caseId}-alquiler`}>Alquiler mensual
        <input id={`prescore-${caseId}-alquiler`} name="alquiler" type="text" inputMode="decimal" placeholder="Ej: 1.250.000" />
      </label>
      <label htmlFor={`prescore-${caseId}-moneda`}>Moneda
        <SelectField name="moneda" label="Moneda" defaultValue="ARS" placeholder="Seleccionar" options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} />
      </label>
      <SubmitButton yaGenerada={yaGenerada} />
    </form>
  );
}
