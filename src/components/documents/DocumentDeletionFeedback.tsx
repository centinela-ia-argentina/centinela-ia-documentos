import styles from './DocumentMutationFeedback.module.css';

/** Only known, non-sensitive result codes are rendered. */
export function DocumentDeletionFeedback({ result }: { result?: string }) {
  if (!result || !['ok', 'failed', 'partial', 'audit'].includes(result)) return null;
  return <div className={styles.feedback} role={result === 'ok' ? 'status' : 'alert'} aria-live="polite">
    <p>{result === 'ok' ? 'Documento eliminado correctamente.'
      : result === 'partial' ? 'No se pudo completar la eliminación. Puede haberse borrado el archivo o parte de sus datos asociados. Revisá el registro antes de reintentar; no se confirma una eliminación completa.'
      : result === 'audit' ? 'El documento se eliminó, pero no se pudo confirmar el registro de auditoría. No vuelvas a borrarlo; solicitá la revisión de la auditoría.'
      : 'No se pudo verificar el documento para eliminarlo. No se confirmó la eliminación. Actualizá la vista y revisá el registro.'}</p>
  </div>;
}

export function DocumentArchiveFeedback({ result }: { result?: string }) {
  if (result !== 'failed' && result !== 'audit') return null;
  return <div className={styles.feedback} role="alert"><p>{result === 'failed'
    ? 'No se pudo confirmar el cambio de archivo. Actualizá la colección para comprobar su estado antes de reintentar.'
    : 'Se cambió el estado de archivo, pero no se pudo confirmar la auditoría. No repitas la acción; solicitá su revisión.'}</p></div>;
}
