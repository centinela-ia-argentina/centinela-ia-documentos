'use client';

import { useState } from 'react';
import { ImagePlus, Download, Trash2, Loader2, Repeat } from 'lucide-react';

type Item = { id: string; nombre: string; dataUrl: string; pesoOriginal: number };

function nombreBase(nombre: string) {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? nombre.slice(0, i) : nombre;
}

function convertir(
  dataUrl: string,
  formato: 'image/jpeg' | 'image/png',
  calidad: number,
  maxAncho: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (maxAncho > 0 && w > maxAncho) {
        h = Math.round((h * maxAncho) / w);
        w = maxAncho;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      // Fondo blanco al pasar a JPG (evita fondo negro si el PNG era transparente)
      if (formato === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(formato, calidad));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function formatoPeso(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConversorImagenes() {
  const [items, setItems] = useState<Item[]>([]);
  const [formato, setFormato] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [calidad, setCalidad] = useState(0.7);
  const [reducir, setReducir] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const agregar = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () =>
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            nombre: file.name,
            dataUrl: String(reader.result),
            pesoOriginal: file.size,
          },
        ]);
      reader.readAsDataURL(file);
    });
  };

  const quitar = (id: string) =>
    setItems((prev) => prev.filter((x) => x.id !== id));

  const descargar = async (item: Item) => {
    setProcesando(true);
    try {
      const out = await convertir(
        item.dataUrl,
        formato,
        calidad,
        reducir ? 1600 : 0
      );
      const ext = formato === 'image/jpeg' ? 'jpg' : 'png';
      const a = document.createElement('a');
      a.href = out;
      a.download = `${nombreBase(item.nombre)}.${ext}`;
      a.click();
    } finally {
      setProcesando(false);
    }
  };

  const descargarTodo = async () => {
    for (const item of items) {
       
      await descargar(item);
    }
  };

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40">
        <ImagePlus className="h-7 w-7 text-emerald-500" />
        <span className="mt-2 text-sm font-semibold text-slate-700">
          Elegí imágenes para convertir o comprimir
        </span>
        <span className="mt-1 text-xs text-slate-500">JPG o PNG</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {items.length > 0 && (
        <>
          <div className="grid gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Convertir a</span>
              <select
                value={formato}
                onChange={(e) =>
                  setFormato(e.target.value as 'image/jpeg' | 'image/png')
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="image/jpeg">JPG (más liviano)</option>
                <option value="image/png">PNG (sin pérdida)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Calidad{' '}
                {formato === 'image/jpeg'
                  ? `(${Math.round(calidad * 100)}%)`
                  : '(no aplica a PNG)'}
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={calidad}
                disabled={formato !== 'image/jpeg'}
                onChange={(e) => setCalidad(Number(e.target.value))}
                className="accent-emerald-600 disabled:opacity-40"
              />
            </label>

            <label className="flex items-center gap-2 text-sm sm:mt-6">
              <input
                type="checkbox"
                checked={reducir}
                onChange={(e) => setReducir(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <span className="font-medium text-slate-700">
                Reducir a máx 1600px
              </span>
            </label>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.dataUrl}
                  alt={item.nombre}
                  className="h-12 w-12 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    Original: {formatoPeso(item.pesoOriginal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => descargar(item)}
                  disabled={procesando}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </button>
                <button
                  type="button"
                  onClick={() => quitar(item.id)}
                  aria-label="Quitar"
                  className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={descargarTodo}
              disabled={procesando}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {procesando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
              {procesando ? 'Procesando…' : 'Descargar todo'}
            </button>
            <button
              type="button"
              onClick={() => setItems([])}
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
