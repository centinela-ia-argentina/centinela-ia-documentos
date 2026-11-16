'use client';

import { useEffect, useState } from 'react';
import { indexarDocumentosExistentes, obtenerMetricasIndexacion, type BackfillResult } from './actions';

export function BackfillDocs() {
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<BackfillResult | null>(null);
  const [metricas, setMetricas] = useState<{ totalAnalizados: number; totalIndexados: number; pendientes: number } | null>(null);

  const cargarMetricas = async () => {
    try {
      const m = await obtenerMetricasIndexacion();
      setMetricas(m);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    let activo = true;
    void obtenerMetricasIndexacion()
      .then((m) => {
        if (activo) setMetricas(m);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  async function run() {
    setCargando(true);
    setRes(null);
    try {
      const result = await indexarDocumentosExistentes();
      setRes(result);
      await cargarMetricas();
    } catch {
      setRes({ ok: false, error: 'No se pudo completar.' });
    } finally {
      setCargando(false);
    }
  }

  const sinPendientes = metricas !== null && metricas.pendientes === 0;

  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
      <h3 className="text-[14px] font-bold text-neutral-900">
        Indexación de documentos para búsqueda inteligente{' '}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-bold text-neutral-500">admin</span>
      </h3>

      {metricas && (
        <div className="mt-3.5 flex flex-wrap gap-3">
          <div className="min-w-[110px] flex-1 rounded-lg border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
            <p className="text-[11.5px] font-semibold text-neutral-500">Analizados</p>
            <p className="mt-0.5 text-lg font-bold text-neutral-900">{metricas.totalAnalizados}</p>
          </div>
          <div className="min-w-[110px] flex-1 rounded-lg border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
            <p className="text-[11.5px] font-semibold text-neutral-500">Indexados</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-700">{metricas.totalIndexados}</p>
          </div>
          <div className="min-w-[110px] flex-1 rounded-lg border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
            <p className="text-[11.5px] font-semibold text-neutral-500">Pendientes</p>
            <p className={`mt-0.5 text-lg font-bold ${metricas.pendientes > 0 ? 'text-amber-700' : 'text-neutral-400'}`}>
              {metricas.pendientes}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
        Los documentos analizados con IA se fragmentan e indexan para búsquedas semánticas precisas.
        {sinPendientes ? ' Todos los documentos analizados ya están indexados.' : ' Si hay documentos analizados pendientes, podés indexarlos ahora.'}
      </p>

      <button
        onClick={run}
        disabled={cargando || sinPendientes}
        className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-[12px] font-bold text-neutral-900 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cargando ? 'Indexando…' : sinPendientes ? 'Sin documentos pendientes' : 'Indexar documentos pendientes'}
      </button>

      {res && (
        <div className="mt-3 text-[12px]">
          {res.ok ? (
            <p className="text-emerald-700">
              ✅ Listo: {res.indexados} indexados · {res.yaIndexados} ya estaban · {res.sinTexto} sin
              texto · {res.errores} con error (de {res.total} analizados).
            </p>
          ) : (
            <p className="text-rose-700">{res.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
