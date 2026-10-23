'use client';

import styles from './IndustryTools.module.css';
import { useFormStatus } from 'react-dom';
import { analizarUifExpediente } from '../actions';

function SubmitButton({ yaGenerada }: { yaGenerada: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.action}
    >
      {pending ? 'Analizando riesgo…' : yaGenerada ? 'Reanalizar riesgo UIF/PLA' : 'Analizar riesgo UIF/PLA (IA)'}
    </button>
  );
}

export function AnalizarUifButton({ caseId, yaGenerada }: { caseId: string; yaGenerada: boolean }) {
  return (
    <form action={analizarUifExpediente.bind(null, caseId)}>
      <SubmitButton yaGenerada={yaGenerada} />
    </form>
  );
}
