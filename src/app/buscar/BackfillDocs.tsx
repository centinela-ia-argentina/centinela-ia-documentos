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
    <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          Indexación de documentos para búsqueda inteligente <span className="font-normal text-slate-400">(admin)</span>
        </h3>
        {metricas && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Analizados: <strong className="text-white">{metricas.totalAnalizados}</strong></span>
            <span>Indexados: <strong className="text-emerald-400">{metricas.totalIndexados}</strong></span>
            <span>Pendientes: <strong className={metricas.pendientes > 0 ? 'text-amber-400' : 'text-slate-400'}>{metricas.pendientes}</strong></span>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Los documentos analizados con IA se fragmentan e indexan para búsquedas semánticas precisas.
        {sinPendientes ? ' Todos los documentos analizados ya están indexados.' : ' Si hay documentos analizados pendientes, podés indexarlos ahora.'}
      </p>

      <button
        onClick={run}
        disabled={cargando || sinPendientes}
        className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cargando ? 'Indexando…' : sinPendientes ? 'Sin documentos pendientes' : 'Indexar documentos pendientes'}
      </button>

      {res && (
        <div className="mt-3 text-xs">
          {res.ok ? (
            <p className="text-emerald-400">
              ✅ Listo: {res.indexados} indexados · {res.yaIndexados} ya estaban · {res.sinTexto} sin
              texto · {res.errores} con error (de {res.total} analizados).
            </p>
          ) : (
            <p className="text-rose-400">{res.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
