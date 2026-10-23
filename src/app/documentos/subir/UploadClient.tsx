'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadSingleDocumentAsync } from '../actions';
import { UploadCloud, X, Loader2, FileIcon, CheckCircle2, AlertCircle } from 'lucide-react';

import Link from 'next/link';
import styles from './Upload.module.css';
import { IndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';

export function UploadClient({
  cases,
  documentTypes,
  initialCaseId,
  industry = 'general',
}: {
  cases: { id: string; title: string }[];
  documentTypes: string[];
  initialCaseId: string;
  industry?: IndustryType;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const router = useRouter();
  const terms = getIndustryTerms(industry);
  const MAX_FILE_SIZE_MB = 50;
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [caseId, setCaseId] = useState(initialCaseId);
  const [documentType, setDocumentType] = useState('');
  const [sensitivityLevel, setSensitivityLevel] = useState('medium');
  const [expiresAt, setExpiresAt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, { status: 'pending' | 'uploading' | 'success' | 'duplicate' | 'error'; error?: string; duplicateId?: string }>>({});

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading]);

  const handleFilesSelected = (selectedFiles: File[]) => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    setRejected(selectedFiles.filter(f => !validTypes.includes(f.type) || f.size > MAX_FILE_SIZE_MB * 1024 * 1024).map(f => `${f.name}: ${!validTypes.includes(f.type) ? 'formato no permitido' : 'supera 50 MB'}.`));
    const valid = selectedFiles.filter(f => validTypes.includes(f.type) && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);

    setFiles(prev => {
      const wrappedFiles = valid.map(f => ({ id: crypto.randomUUID(), file: f }));
      const newFiles = [...prev, ...wrappedFiles];
      const initialStatus = { ...uploadStatus };
      wrappedFiles.forEach(wf => {
        initialStatus[wf.id] = { status: 'pending' };
      });
      setUploadStatus(initialStatus);
      return newFiles;
    });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setUploadStatus(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const retryUpload = async (id: string, file: File) => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadStatus(prev => ({ ...prev, [id]: { status: 'uploading' } }));

    const fd = new FormData();
    fd.append('file', file);
    fd.append('case_id', caseId);
    fd.append('document_type', documentType);
    fd.append('sensitivity_level', sensitivityLevel);
    fd.append('expires_at', expiresAt);

    try {
      const res = await uploadSingleDocumentAsync(fd);
      if (res.status === 'success') {
        setUploadStatus(prev => ({ ...prev, [id]: { status: 'success' } }));
      } else if (res.status === 'duplicate') {
        setUploadStatus(prev => ({ ...prev, [id]: { status: 'duplicate', duplicateId: res.existingDocumentId } }));
      } else {
        setUploadStatus(prev => ({ ...prev, [id]: { status: 'error', error: res.error || 'Error' } }));
      }
    } catch (err: any) {
      setUploadStatus(prev => ({ ...prev, [id]: { status: 'error', error: err.message || 'Error' } }));
    }
    setIsUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setIsUploading(true);

    const uploadTasks = files.map(wf => async () => {
      if (uploadStatus[wf.id]?.status === 'success') return; // Skip already uploaded

      setUploadStatus(prev => ({ ...prev, [wf.id]: { status: 'uploading' } }));

      const fd = new FormData();
      fd.append('file', wf.file);
      fd.append('case_id', caseId);
      fd.append('document_type', documentType);
      fd.append('sensitivity_level', sensitivityLevel);
      fd.append('expires_at', expiresAt);

      const res = await uploadSingleDocumentAsync(fd);

      if (res.status === 'success') {
        setUploadStatus(prev => ({ ...prev, [wf.id]: { status: 'success' } }));
      } else if (res.status === 'duplicate') {
        setUploadStatus(prev => ({ ...prev, [wf.id]: { status: 'duplicate', duplicateId: res.existingDocumentId } }));
      } else {
        setUploadStatus(prev => ({ ...prev, [wf.id]: { status: 'error', error: res.error || 'Error al subir' } }));
      }
    });

    const maxConcurrent = 3;
    const queue = [...uploadTasks];
    const runWorker = async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
          try {
            await task();
          } catch (e) {}
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(maxConcurrent, uploadTasks.length); i++) {
      workers.push(runWorker());
    }

    await Promise.allSettled(workers);
    setIsUploading(false);
  };

  // Summary calc
  const totalFiles = files.length;
  const successCount = Object.values(uploadStatus).filter(s => s.status === 'success').length;
  const errorCount = Object.values(uploadStatus).filter(s => s.status === 'error').length;
  const duplicateCount = Object.values(uploadStatus).filter(s => s.status === 'duplicate').length;

  useEffect(() => {
    // Eliminado el redireccionamiento automático para permitir que
    // el usuario (y E2E) vea el resumen de estado y decida cuándo avanzar.
  }, [isUploading, totalFiles, successCount, errorCount, caseId, router]);

  const destination = cases.find(item => item.id === caseId)?.title || 'Sin asociación';
  return (
    <div className={styles.root}>
      {totalFiles > 0 && (successCount > 0 || errorCount > 0 || duplicateCount > 0) && !isUploading && (
        <section className={styles.uploadResults} data-testid="upload-summary" aria-label="Resultado de la carga" role="status">
          <h2>Resultado de la carga</h2><p>Revisá cada archivo antes de continuar.</p>
          <dl><div><dt>Seleccionados</dt><dd>{totalFiles}</dd></div><div><dt>Cargados</dt><dd data-testid="upload-success-count">{successCount}</dd></div><div><dt>Errores</dt><dd data-testid="upload-error-count">{errorCount}</dd></div><div><dt>Duplicados omitidos</dt><dd data-testid="upload-duplicate-count">{duplicateCount}</dd></div></dl>
          {successCount > 0 && <button type="button" onClick={() => {router.refresh(); router.push(caseId ? `${industry === 'inmobiliaria' ? '/operaciones' : '/expedientes'}/${caseId}?tab=documentos` : '/documentos');}}>{caseId ? `Ver en ${terms.elExpediente}` : 'Ver documentos'}</button>}
        </section>
      )}
      <div className={styles.uploadLayout}>
      <form onSubmit={handleSubmit}>
        <section><header className={styles.uploadSectionHead}><h2>Datos de la carga</h2><p>Se aplican a todos los archivos seleccionados.</p></header>
          <div className={styles.uploadFields}>
            <div className={`${styles.uploadField} ${styles.uploadFull}`}><label htmlFor="uploadCase">{terms.expedienteSingular}</label>
              <select id="uploadCase" name="case_id" data-testid="upload-case" value={caseId} onChange={e => setCaseId(e.target.value)} disabled={isUploading} aria-describedby="uploadCaseHelp">
                <option value="">{industry === 'inmobiliaria' ? 'Sin asociar a una operación' : `Sin ${terms.expedienteSingular.toLowerCase()} / general`}</option>
                {cases.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select><p id="uploadCaseHelp">Podés cambiar el destino o cargar sin asociación. Los reintentos usan los datos actuales.</p>
            </div>
            <div className={styles.uploadField}><label htmlFor="uploadType">Tipo documental</label><select id="uploadType" name="document_type" data-testid="upload-type" value={documentType} onChange={e => setDocumentType(e.target.value)} disabled={isUploading}><option value="">Sin Clasificar</option>{documentTypes.map(dt => <option key={dt} value={dt}>{dt}</option>)}</select></div>
            <div className={styles.uploadField}><label htmlFor="uploadSensitivity">Nivel de sensibilidad</label><select id="uploadSensitivity" name="sensitivity_level" data-testid="upload-sensitivity" value={sensitivityLevel} onChange={e => setSensitivityLevel(e.target.value)} disabled={isUploading}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option><option value="critical">Crítico</option></select></div>
            <div className={styles.uploadField}><label htmlFor="uploadExpiry">Fecha de vencimiento <span>· Opcional</span></label><input id="uploadExpiry" name="expires_at" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} disabled={isUploading} aria-describedby="uploadExpiryHelp"/><p id="uploadExpiryHelp">Completala solo si los documentos vencen.</p></div>
          </div>
        </section>
        <section className={styles.uploadFiles} aria-labelledby="uploadFilesTitle"><header className={`${styles.uploadSectionHead} ${styles.uploadFilesHead}`}><h2 id="uploadFilesTitle">Archivos</h2><span>{totalFiles} seleccionados</span></header>
          <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} className={`${styles.uploadDrop} ${isDragging ? styles.drag : ''}`}>
            <UploadCloud aria-hidden="true"/><p>Arrastrá tus archivos acá</p><span>o</span>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={isUploading}>Seleccionar archivos</button>
            <input ref={fileInput} id="uploadFileInput" type="file" multiple data-testid="upload-file-input" aria-label="Seleccionar archivos" aria-describedby="uploadFormats" className={styles.uploadFileInput} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e => {if(e.target.files) handleFilesSelected(Array.from(e.target.files)); e.target.value = '';}} disabled={isUploading}/>
            <p id="uploadFormats">PDF, JPG, PNG, DOCX y XLSX · Máximo 50 MB por archivo.</p>
          </div>
          <p className={styles.uploadPrivacy}>Los archivos se enviarán al almacenamiento privado de tu organización al confirmar la carga.</p>
          {rejected.length > 0 && <div className={styles.uploadSelectionAlert} role="alert">{rejected.map((message,i) => <p key={i}>{message}</p>)}</div>}
          {!files.length && <p className={styles.uploadEmpty}>Todavía no seleccionaste archivos.</p>}
          <ul className={styles.uploadQueue} aria-label="Archivos seleccionados">{files.map(wf => {
            const state = uploadStatus[wf.id]; const status = state?.status || 'pending';
            const labels = {pending:'Preparado',uploading:'En curso',success:'Cargado',duplicate:'Duplicado',error:'Error'};
            const Icon = status === 'uploading' ? Loader2 : status === 'success' ? CheckCircle2 : status === 'error' || status === 'duplicate' ? AlertCircle : FileIcon;
            return <li className={styles.uploadFileRow} key={wf.id}><div className={styles.uploadFileName}><FileIcon aria-hidden="true"/><div><h3>{wf.file.name}</h3><p>{wf.file.size < 1024 * 1024 ? `${(wf.file.size / 1024).toFixed(2)} KB` : `${(wf.file.size / 1024 / 1024).toFixed(2)} MB`}</p>{status === 'error' && <p className={styles.uploadErrorText}>{state.error || 'Error al subir'}</p>}</div></div>
              <div className={styles.uploadFileActions}><span className={styles.status} data-state={status}><Icon aria-hidden="true"/>{labels[status]}</span>
                {status === 'duplicate' && state?.duplicateId && <Link href={`/documentos/${state.duplicateId}`} target="_blank" rel="noreferrer">Ver archivo</Link>}
                {status === 'error' && <button type="button" disabled={isUploading} onClick={() => retryUpload(wf.id,wf.file)}>Reintentar</button>}
                {(status === 'pending' || status === 'error') && !isUploading && <button type="button" aria-label={`Quitar ${wf.file.name} de la selección`} onClick={() => {removeFile(wf.id); fileInput.current?.focus();}}><X aria-hidden="true"/></button>}
              </div></li>;
          })}</ul>
        </section>
        <footer className={styles.uploadActions}><button type="submit" data-testid="upload-submit" disabled={isUploading || !files.length} className={styles.primary}>{isUploading ? 'Subiendo…' : `Subir ${files.length} documento${files.length !== 1 ? 's' : ''}`}</button><p>Subir no implica analizar ni confirmar validez documental.</p></footer>
      </form>
      <aside className={styles.uploadAside} aria-label="Antes de subir"><p className={styles.eyebrow}>ANTES DE SUBIR</p><h2>Un destino, los mismos datos</h2><section><h3>{terms.expedienteSingular} de destino</h3><p>{destination}</p></section><section><h3>Almacenamiento privado</h3><p>Los archivos quedan asociados a tu organización.</p></section><section><h3>Un archivo no equivale a una revisión</h3><p>Subir no confirma validez documental ni revisión profesional. El análisis IA es una acción separada.</p></section><p className={styles.uploadAsideNote}>Para usar tipos, sensibilidades o fechas diferentes, prepará cargas separadas.</p></aside>
      </div>
    </div>
  );
}
