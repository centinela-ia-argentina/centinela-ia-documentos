'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uploadSingleDocumentAsync } from '../actions';
import { UploadCloud, X, Loader2, FileIcon, CheckCircle2, AlertCircle } from 'lucide-react';

export function UploadClient({
  cases,
  documentTypes,
  initialCaseId,
}: {
  cases: { id: string; title: string }[];
  documentTypes: string[];
  initialCaseId: string;
}) {
  const router = useRouter();
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesSelected = (selectedFiles: File[]) => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

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
    if (totalFiles > 0 && !isUploading && successCount === totalFiles && errorCount === 0) {
      router.refresh();
      if (caseId) {
        router.push(`/expedientes/${caseId}?tab=documentos`);
      } else {
        router.push('/documentos');
      }
    }
  }, [isUploading, totalFiles, successCount, errorCount, caseId, router]);

  return (
    <div className="space-y-6">
      {totalFiles > 0 && (successCount > 0 || errorCount > 0 || duplicateCount > 0) && !isUploading && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6" data-testid="upload-summary">
          <h3 className="font-semibold text-slate-800 mb-2">Resumen de Subida</h3>
          <ul className="text-sm text-slate-600 space-y-1 mb-4">
            <li>Total procesados: {totalFiles}</li>
            <li className="text-emerald-600 font-medium" data-testid="upload-success-count">Completados con éxito: {successCount}</li>
            {errorCount > 0 && <li className="text-rose-600 font-medium" data-testid="upload-error-count">Errores: {errorCount}</li>}
            {duplicateCount > 0 && <li className="text-amber-600 font-medium" data-testid="upload-duplicate-count">Duplicados omitidos: {duplicateCount}</li>}
          </ul>
          {successCount > 0 && (
            <div className="pt-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  router.refresh();
                  if (caseId) {
                    router.push(`/expedientes/${caseId}?tab=documentos`);
                  } else {
                    router.push('/documentos');
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                {caseId ? 'Ver en el legajo' : 'Ver documentos'}
              </button>
            </div>
          )}
        </div>
      )}

    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5">
        <div>
          <label className="text-sm font-semibold text-slate-700">Expediente</label>
          <select
            value={caseId}
            data-testid="upload-case"
            onChange={(e) => setCaseId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
            disabled={isUploading}
          >
            <option value="">Sin expediente / general</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Tipo documental</label>
          <select
            value={documentType}
            data-testid="upload-type"
            onChange={(e) => setDocumentType(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
            disabled={isUploading}
          >
            <option value="">Sin Clasificar</option>
            {documentTypes.map((dt) => (
              <option key={dt} value={dt}>{dt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Nivel de sensibilidad</label>
          <select
            value={sensitivityLevel}
            data-testid="upload-sensitivity"
            onChange={(e) => setSensitivityLevel(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
            disabled={isUploading}
          >
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
            <option value="critical">Crítico</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Fecha de vencimiento</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
            disabled={isUploading}
          />
          <p className="mt-2 text-xs text-slate-500">Opcional. Si los documentos vencen, indicá la fecha. Se aplica a todos los seleccionados.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Archivos</label>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-colors ${
              isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              multiple
              data-testid="upload-file-input"
              onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              disabled={isUploading}
            />
            <UploadCloud className={`h-10 w-10 mb-3 ${isDragging ? 'text-sky-500' : 'text-slate-400'}`} />
            <p className="text-sm font-semibold text-slate-700">Arrastrá tus archivos acá o hacé clic para seleccionar</p>
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, DOCX, XLSX. Máximo {MAX_FILE_SIZE_MB} MB por archivo.</p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((wf) => {
                const status = uploadStatus[wf.id]?.status || 'pending';
                return (
                  <div key={wf.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileIcon className="h-5 w-5 text-slate-400 shrink-0" />
                      <div className="truncate text-sm font-medium text-slate-700">
                        {wf.file.name}
                        <div className="text-xs text-slate-400 font-normal">
                          {wf.file.size < 1024 * 1024 
                            ? `${(wf.file.size / 1024).toFixed(2)} KB` 
                            : `${(wf.file.size / 1024 / 1024).toFixed(2)} MB`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-sky-500" />}
                      {status === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {status === 'duplicate' && (
                        <div className="flex items-center gap-1 text-amber-500 text-xs">
                          <AlertCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">Duplicado</span>
                          {uploadStatus[wf.id]?.duplicateId && (
                            <a href={`/documentos/${uploadStatus[wf.id].duplicateId}`} target="_blank" rel="noreferrer" className="underline ml-1 hover:text-amber-600">
                              Ver archivo
                            </a>
                          )}
                        </div>
                      )}
                      {status === 'error' && (
                        <div className="flex items-center gap-1 text-rose-500 text-xs">
                          <AlertCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">{uploadStatus[wf.id]?.error || 'Error'}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); retryUpload(wf.id, wf.file); }}
                            className="ml-2 underline hover:text-rose-600"
                          >
                            Reintentar
                          </button>
                        </div>
                      )}

                      {(status === 'pending' || status === 'error') && !isUploading && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); removeFile(wf.id); }}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        data-testid="upload-submit"
        disabled={isUploading || files.length === 0}
        className="mt-6 flex w-full justify-center items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Subiendo...
          </>
        ) : (
          `Subir ${files.length} documento${files.length !== 1 ? 's' : ''}`
        )}
      </button>
    </form>
    </div>
  );
}
