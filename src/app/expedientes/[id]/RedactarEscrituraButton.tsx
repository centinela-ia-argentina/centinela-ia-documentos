'use client';

import styles from './IndustryTools.module.css';
import { useFormStatus } from 'react-dom';
import { redactarEscrituraExpediente } from '../actions';

function SubmitButton({ yaGenerada }: { yaGenerada: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.action}
    >
      {pending ? 'Redactando borrador…' : yaGenerada ? 'Regenerar borrador' : 'Redactar borrador de escritura (IA)'}
    </button>
  );
}

export function RedactarEscrituraButton({ caseId, yaGenerada }: { caseId: string; yaGenerada: boolean }) {
  return (
    <form action={redactarEscrituraExpediente.bind(null, caseId)}>
      <SubmitButton yaGenerada={yaGenerada} />
    </form>
  );
}
