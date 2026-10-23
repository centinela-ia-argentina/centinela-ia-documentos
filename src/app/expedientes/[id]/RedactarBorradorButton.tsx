'use client';

import styles from './IndustryTools.module.css';
import { useFormStatus } from 'react-dom';
import { redactarBorradorInmobiliaria } from '../actions';

function SubmitButton({ yaGenerado }: { yaGenerado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={styles.action}
    >
      {pending ? 'Redactando borrador…' : yaGenerado ? 'Regenerar borrador' : 'Redactar borrador de reserva/boleto (IA)'}
    </button>
  );
}

export function RedactarBorradorButton({ caseId, yaGenerado }: { caseId: string; yaGenerado: boolean }) {
  return (
    <form action={redactarBorradorInmobiliaria.bind(null, caseId)}>
      <SubmitButton yaGenerado={yaGenerado} />
    </form>
  );
}
