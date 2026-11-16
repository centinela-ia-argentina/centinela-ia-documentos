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

export function ComprimirPdf({ canSave = true }: { canSave?: boolean }) {
	const [file, setFile] = useState<File | null>(null);
	const [nivel, setNivel] = useState<Nivel>('media');
	const [procesando, setProcesando] = useState(false);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [aviso, setAviso] = useState<string | null>(null);
	const [descargaSolicitada, setDescargaSolicitada] = useState(false);
	const [resultado, setResultado] = useState<{ blob: Blob; original: number; nuevo: number; nivel: Nivel; fileName: string } | null>(null);

	const elegir = async (files: FileList | null) => {
		const f = files?.[0];
		setError(null);
		setResultado(null);
		setDescargaSolicitada(false);
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

		// Instantánea: el archivo quedó fijado al elegirlo; cambiarlo invalida el resultado.
		setFile(f);
	};

	// Cambiar el nivel invalida el resultado previo: corresponde a otra preparación.
	const cambiarNivel = (nuevo: Nivel) => {
		setNivel(nuevo);
		setResultado(null);
		setDescargaSolicitada(false);
	};

	// Rasteriza cada página con PDF.js y rearma un PDF nuevo con jsPDF.
	// Integridad: si cualquier página no puede representarse, la preparación
	// falla completa; nunca se ofrece un PDF incompleto como resultado.
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
			const vp1 = page.getViewport({ scale: 1 });
			const vp = page.getViewport({ scale: escala });

			const canvas = document.createElement('canvas');
			canvas.width = vp.width;
			canvas.height = vp.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				canvas.width = 0;
				canvas.height = 0;
				throw new Error(`No se pudo representar la página ${i}.`);
			}
			try {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
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
			} finally {
				canvas.width = 0;
				canvas.height = 0;
			}
		}

		if (!out) throw new Error('PDF vacío');
		return out.output('blob');
	};

	const comprimir = async () => {
		if (!file || procesando) return;
		setProcesando(true);
		setError(null);
		setResultado(null);
		setDescargaSolicitada(false);
		try {
			// Instantánea del archivo y del nivel al iniciar la preparación.
			const instantanea = { archivo: file, nivel };
			const blob = await construirPdf();
			setResultado({
				blob,
				original: instantanea.archivo.size,
				nuevo: blob.size,
				nivel: instantanea.nivel,
				fileName: instantanea.archivo.name,
			});
		} catch (e) {
			setError('No se pudo completar la compresión de todas las páginas. No se genera ni se ofrece un archivo parcial. Verificá que sea un PDF válido y no esté protegido con contraseña.');
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
		// La solicitud de descarga no acredita que el archivo quedó guardado en el dispositivo.
		setDescargaSolicitada(true);
	};

	const guardarEnDocumentos = async () => {
		if (!canSave || !resultado || guardando) return;
		setGuardando(true);
		setError(null);
		setAviso(null);
		try {
			const nombre = `comprimido-${resultado.fileName}`;
			const nuevo = new File([resultado.blob], nombre, { type: 'application/pdf' });
			const fd = new FormData();
			fd.append('file', nuevo);
			fd.append('sensitivity_level', 'medium');
			await uploadDocument(fd);
			setAviso('Solicitud de guardado enviada. Revisá Documentos para confirmar que el archivo quedó registrado.');
			setGuardando(false);
		} catch (e) {
			// Un fallo después de iniciar el envío deja el resultado incierto:
			// no se afirma rollback ni ausencia de archivo.
			setError('El resultado del envío a Documentos es incierto. Revisá Documentos antes de reintentar para evitar duplicados.');
			setGuardando(false);
		}
	};

	const ahorro = resultado ? Math.round((1 - resultado.nuevo / resultado.original) * 100) : 0;
	const resultadoVigente = resultado && file && resultado.fileName === file.name && resultado.nivel === nivel ? resultado : null;

	return (
		<div className="space-y-4">
			{!file ? (
				<label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50">
					<FileDown className="h-8 w-8 text-slate-400" />
					<span className="text-sm font-medium text-slate-600">Elegí un archivo PDF</span>
					<span className="text-xs text-slate-400">Convierte cada página en imagen; ideal para PDF escaneados</span>
					<input
						type="file"
						accept="application/pdf"
						className="sr-only"
						onChange={(e) => {
							elegir(e.target.files);
							e.target.value = '';
						}}
					/>
				</label>
			) : (
				// Ficha compacta: reemplaza el área grande de selección cuando hay archivo.
				<div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
					<FileText className="h-5 w-5 shrink-0 text-sky-500" />
					<span className="flex-1 truncate text-sm font-medium text-slate-700">{file.name}</span>
					<span className="text-xs text-slate-400">{formatoTamano(file.size)}</span>
					<label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
						Elegir otro PDF
						<input
							type="file"
							accept="application/pdf"
							className="sr-only"
							onChange={(e) => {
								elegir(e.target.files);
								e.target.value = '';
							}}
						/>
					</label>
				</div>
			)}

			<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
				El texto deja de ser seleccionable (cada página queda como imagen). Ideal para documentos escaneados o con fotos.
			</p>

			{error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
			{aviso && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800" role="status">{aviso}</p>}

			<div>
				<p className="mb-2 text-sm font-medium text-slate-600">Nivel de compresión</p>
				<div className="flex flex-wrap gap-2">
					{(Object.keys(NIVELES) as Nivel[]).map((k) => (
						<button
							key={k}
							onClick={() => cambiarNivel(k)}
							aria-pressed={nivel === k}
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
					disabled={procesando || !file}
					className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
				>
					{procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
					{procesando ? 'Comprimiendo…' : 'Comprimir PDF'}
				</button>
				<button onClick={() => { setFile(null); setResultado(null); setDescargaSolicitada(false); setAviso(null); }} className="text-sm font-medium text-slate-500 underline">
					Limpiar
				</button>
			</div>

			{resultadoVigente && (
				<div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
						<span className="text-slate-500">Original: <b className="text-slate-700">{formatoTamano(resultadoVigente.original)}</b></span>
						<span className="text-slate-500">Comprimido: <b className="text-slate-700">{formatoTamano(resultadoVigente.nuevo)}</b></span>
						<span className={`font-semibold ${ahorro > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
							{ahorro > 0 ? `−${ahorro}% de peso` : 'El tamaño comparado no mejoró'}
						</span>
					</div>
					{ahorro <= 0 && (
						<p className="text-xs text-slate-400">
							El tamaño no disminuyó respecto del original; igual podés descargar el resultado.
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
						{canSave && (
							<button
								onClick={guardarEnDocumentos}
								disabled={guardando}
								className="inline-flex items-center gap-2 rounded-lg border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
							>
								{guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
								{guardando ? 'Guardando…' : 'Guardar en Documentos'}
							</button>
						)}
					</div>
					{descargaSolicitada ? (
						<p className="text-xs text-slate-500" role="status">
							Se solicitó la descarga al navegador; no se puede confirmar desde aquí que el archivo quedó guardado en tu dispositivo.
						</p>
					) : null}
				</div>
			)}
		</div>
	);
}
