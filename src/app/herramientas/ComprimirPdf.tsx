'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { FileDown, Download, Loader2, FolderPlus, FileText } from 'lucide-react';
import { uploadDocument } from '@/app/documentos/actions';

type Nivel = 'alta' | 'media' | 'baja';

// Cada nivel = (escala de render, calidad JPEG). Más escala/calidad = más nítido y más pesado.
const NIVELES: Record<Nivel, { escala: number; calidad: number; label: string; sub: string }> = {
	alta: { escala: 2.0, calidad: 0.82, label: 'Máxima calidad', sub: 'Menos compresión' },
	media: { escala: 1.5, calidad: 0.6, label: 'Equilibrada', sub: 'Recomendada' },
	baja: { escala: 1.1, calidad: 0.5, label: 'Máxima compresión', sub: 'Más liviano' },
};

function formatoTamano(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ComprimirPdf() {
	const [file, setFile] = useState<File | null>(null);
	const [nivel, setNivel] = useState<Nivel>('media');
	const [procesando, setProcesando] = useState(false);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultado, setResultado] = useState<{ blob: Blob; original: number; nuevo: number } | null>(null);

	const elegir = async (files: FileList | null) => {
		const f = files?.[0];
		setError(null);
		setResultado(null);
		if (!f) return;
		if (f.type !== 'application/pdf') {
			setError('El archivo debe ser un PDF.');
			return;
		}

		const slice = f.slice(0, 4);
		const buf = await slice.arrayBuffer();
		const arr = new Uint8Array(buf);
		const header = String.fromCharCode(...arr);
		if (header !== '%PDF') {
		  setError('El archivo no es un PDF válido o está corrupto.');
		  return;
		}

		setFile(f);
	};

	// Rasteriza cada página con PDF.js y rearma un PDF nuevo con jsPDF
	const construirPdf = async (): Promise<Blob> => {
		const pdfjsLib = await import('pdfjs-dist');
		pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

		const { escala, calidad } = NIVELES[nivel];
		const buf = await file!.arrayBuffer();
		// @ts-expect-error isEvalSupported mitigates JS exec but is omitted in TS defs
		const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;

		let out: jsPDF | null = null;
		for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const vp1 = page.getViewport({ scale: 1 }); // tamaño en puntos (pt)
			const vp = page.getViewport({ scale: escala }); // resolución de render

			const canvas = document.createElement('canvas');
			canvas.width = vp.width;
			canvas.height = vp.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) continue;
			// Fondo blanco (evita negro en zonas transparentes al pasar a JPEG)
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await page.render({ canvasContext: ctx, viewport: vp } as any).promise;

			const img = canvas.toDataURL('image/jpeg', calidad);
			const wpt = vp1.width;
			const hpt = vp1.height;
			const orient = wpt > hpt ? 'l' : 'p';

			if (!out) {
				out = new jsPDF({ unit: 'pt', format: [wpt, hpt], orientation: orient });
			} else {
				out.addPage([wpt, hpt], orient);
			}
			out.addImage(img, 'JPEG', 0, 0, wpt, hpt);
		}

		if (!out) throw new Error('PDF vacío');
		return out.output('blob');
	};

	const comprimir = async () => {
		if (!file) return;
		setProcesando(true);
		setError(null);
		setResultado(null);
		try {
			const blob = await construirPdf();
			setResultado({ blob, original: file.size, nuevo: blob.size });
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (e) {
			setError('No se pudo comprimir. Verificá que sea un PDF válido y no esté protegido con contraseña.');
		} finally {
			setProcesando(false);
		}
	};

	const descargar = () => {
		if (!resultado) return;
		const url = URL.createObjectURL(resultado.blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'documento-comprimido.pdf';
		a.click();
		URL.revokeObjectURL(url);
	};

	const guardarEnDocumentos = async () => {
		if (!resultado) return;
		setGuardando(true);
		setError(null);
		try {
			const nuevo = new File([resultado.blob], 'documento-comprimido.pdf', { type: 'application/pdf' });
			const fd = new FormData();
			fd.append('file', nuevo);
			fd.append('sensitivity_level', 'medium');
			await uploadDocument(fd);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (e) {
			setError('No se pudo guardar en Documentos. Intentá de nuevo.');
			setGuardando(false);
		}
	};

	const ahorro = resultado ? Math.round((1 - resultado.nuevo / resultado.original) * 100) : 0;

	return (
		<div className="space-y-4">
			<label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50">
				<FileDown className="h-8 w-8 text-slate-400" />
				<span className="text-sm font-medium text-slate-600">Elegí un archivo PDF</span>
				<span className="text-xs text-slate-400">Convierte cada página en imagen; ideal para PDF escaneados</span>
				<input
					type="file"
					accept="application/pdf"
					className="hidden"
					onChange={(e) => {
						elegir(e.target.files);
						e.target.value = '';
					}}
				/>
			</label>

			<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
				⚠️ El texto deja de ser seleccionable (cada página queda como imagen). Ideal para documentos escaneados o con fotos.
			</p>

			{error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

			{file && (
				<>
					<div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
						<FileText className="h-5 w-5 shrink-0 text-sky-500" />
						<span className="flex-1 truncate text-sm text-slate-700">{file.name}</span>
						<span className="text-xs text-slate-400">{formatoTamano(file.size)}</span>
					</div>

					<div>
						<p className="mb-2 text-sm font-medium text-slate-600">Nivel de compresión</p>
						<div className="flex flex-wrap gap-2">
							{(Object.keys(NIVELES) as Nivel[]).map((k) => (
								<button
									key={k}
									onClick={() => setNivel(k)}
									className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
										nivel === k
											? 'border-sky-600 bg-sky-50 text-sky-700'
											: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
									}`}
								>
									<span className="block font-semibold">{NIVELES[k].label}</span>
									<span className="block text-xs text-slate-400">{NIVELES[k].sub}</span>
								</button>
							))}
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<button
							onClick={comprimir}
							disabled={procesando}
							className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
						>
							{procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
							{procesando ? 'Comprimiendo…' : 'Comprimir PDF'}
						</button>
						<button onClick={() => { setFile(null); setResultado(null); }} className="text-sm font-medium text-slate-500 underline">
							Limpiar
						</button>
					</div>

					{resultado && (
						<div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
							<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
								<span className="text-slate-500">Original: <b className="text-slate-700">{formatoTamano(resultado.original)}</b></span>
								<span className="text-slate-500">Comprimido: <b className="text-slate-700">{formatoTamano(resultado.nuevo)}</b></span>
								<span className={`font-semibold ${ahorro > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
									{ahorro > 0 ? `−${ahorro}% de peso` : 'Ya estaba optimizado'}
								</span>
							</div>
							{ahorro <= 0 && (
								<p className="text-xs text-slate-400">
									Este PDF ya era liviano (probablemente de texto). Igual podés descargarlo.
								</p>
							)}
							<div className="flex flex-wrap items-center gap-3">
								<button
									onClick={descargar}
									className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
								>
									<Download className="h-4 w-4" />
									Descargar
								</button>
								<button
									onClick={guardarEnDocumentos}
									disabled={guardando}
									className="inline-flex items-center gap-2 rounded-lg border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
								>
									{guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
									{guardando ? 'Guardando…' : 'Guardar en Documentos'}
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
