'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ImagePlus,
  ScanLine,
  Download,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  FolderPlus,
} from 'lucide-react';
import { uploadDocument } from '@/app/documentos/actions';

type Imagen = { id: string; nombre: string; dataUrl: string };

// Dibuja la imagen en un canvas; si "escaneado" está activo, la pasa a efecto
// fotocopia (blanquea el fondo del papel + contraste). Siempre devuelve JPEG.
function procesarImagen(
  dataUrl: string,
  escaneado: boolean
): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ src: dataUrl, w: img.naturalWidth, h: img.naturalHeight });
        return;
      }
      ctx.drawImage(img, 0, 0);
      if (escaneado) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        const n = d.length / 4;

        // 1) Escala de grises + histograma de luminosidad
        const gris = new Float32Array(n);
        const hist = new Array(256).fill(0);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          gris[p] = g;
          hist[Math.round(g)]++;
        }

        // 2) "Punto blanco": tono del papel (percentil ~82) para blanquear el fondo
        let acum = 0;
        let blanco = 255;
        const objetivo = n * 0.82;
        for (let v = 0; v < 256; v++) {
          acum += hist[v];
          if (acum >= objetivo) {
            blanco = Math.max(v, 1);
            break;
          }
        }

        // 3) Normalizamos (fondo -> blanco) y subimos contraste (texto -> negro)
        const contraste = 1.55;
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          let v = (gris[p] / blanco) * 255;
          v = (v - 128) * contraste + 128;
          v = Math.max(0, Math.min(255, v));
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(data, 0, 0);
      }
      resolve({
        src: canvas.toDataURL('image/jpeg', 0.92),
        w: canvas.width,
        h: canvas.height,
      });
    };
    img.onerror = () => resolve({ src: dataUrl, w: 1, h: 1 });
    img.src = dataUrl;
  });
}

export function ImagenAPdf({ canSave = true }: { canSave?: boolean }) {
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [escaneado, setEscaneado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const agregar = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () =>
        setImagenes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            nombre: file.name,
            dataUrl: String(reader.result),
          },
        ]);
      reader.readAsDataURL(file);
    });
  };

  const quitar = (id: string) =>
    setImagenes((prev) => prev.filter((x) => x.id !== id));

  const mover = (i: number, dir: -1 | 1) =>
    setImagenes((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });

  // Arma el PDF (reutilizado para descargar y para guardar en la bóveda)
  const construirPdf = async () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const anchoPag = pdf.internal.pageSize.getWidth();
    const altoPag = pdf.internal.pageSize.getHeight();
    const margen = 10;
    const maxW = anchoPag - margen * 2;
    const maxH = altoPag - margen * 2;

    for (let i = 0; i < imagenes.length; i++) {
      const { src, w, h } = await procesarImagen(imagenes[i].dataUrl, escaneado);
      const ratio = Math.min(maxW / w, maxH / h);
      const wmm = w * ratio;
      const hmm = h * ratio;
      const x = (anchoPag - wmm) / 2;
      const y = (altoPag - hmm) / 2;
      if (i > 0) pdf.addPage();
      pdf.addImage(src, 'JPEG', x, y, wmm, hmm);
    }
    return pdf;
  };

  const nombrePdf = () =>
    escaneado ? 'documento-escaneado.pdf' : 'documento.pdf';

  const generarPdf = async () => {
    if (imagenes.length === 0) return;
    setGenerando(true);
    try {
      const pdf = await construirPdf();
      pdf.save(nombrePdf());
    } finally {
      setGenerando(false);
    }
  };

  const guardarEnDocumentos = async () => {
    if (!canSave) return;
    if (imagenes.length === 0) return;
    setGuardando(true);
    try {
      const pdf = await construirPdf();
      const blob = pdf.output('blob');
      const file = new File([blob], nombrePdf(), { type: 'application/pdf' });
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sensitivity_level', 'medium');
      // Sube a la bóveda y redirige al documento nuevo
      await uploadDocument(fd);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50/50">
        <ImagePlus className="h-8 w-8 text-sky-500" />
        <span className="mt-2 text-sm font-semibold text-slate-700">
          Elegí una o varias imágenes
        </span>
        <span className="mt-1 text-xs text-slate-500">
          JPG, PNG o capturas de pantalla
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {imagenes.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={escaneado}
                onChange={(e) => setEscaneado(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <ScanLine className="h-4 w-4 text-slate-500" />
              Modo escaneado (blanco y negro)
            </label>
            <span className="text-xs text-slate-500">
              {imagenes.length} imagen(es)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imagenes.map((img, i) => (
              <div
                key={img.id}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={img.nombre}
                  className={`h-40 w-full object-cover ${
                    escaneado ? 'grayscale brightness-110 contrast-150' : ''
                  }`}
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-1.5">
                  <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                    {i + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      className="rounded bg-white/90 p-1 text-slate-600 hover:bg-white"
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      className="rounded bg-white/90 p-1 text-slate-600 hover:bg-white"
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(img.id)}
                      className="rounded bg-white/90 p-1 text-rose-600 hover:bg-white"
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generarPdf}
              disabled={generando || guardando}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {generando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generando ? 'Generando PDF…' : 'Descargar PDF'}
            </button>

            {canSave && (<button
              type="button"
              onClick={guardarEnDocumentos}
              disabled={generando || guardando}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-600 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-60"
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              {guardando ? 'Guardando…' : 'Guardar en Documentos'}
            </button>)}

            <button
              type="button"
              onClick={() => setImagenes([])}
              className="text-sm font-medium text-slate-500 underline"
            >
              Limpiar todo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
