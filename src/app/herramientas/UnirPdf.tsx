'use client';

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
	FilePlus2,
	Download,
	Trash2,
	Loader2,
	ArrowUp,
	ArrowDown,
	FolderPlus,
	FileText,
} from 'lucide-react';
import { uploadDocument } from '@/app/documentos/actions';

type PdfItem = { id: string; nombre: string; file: File };

export function UnirPdf() {
	const [archivos, setArchivos] = useState<PdfItem[]>([]);
	const [uniendo, setUniendo] = useState(false);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const agregar = (files: FileList | null) => {
		if (!files) return;
		const nuevos: PdfItem[] = [];
		Array.from(files).forEach((file) => {
			if (file.type !== 'application/pdf') return;
			nuevos.push({ id: crypto.randomUUID(), nombre: file.name, file });
		});
		if (nuevos.length > 0) setArchivos((prev) => [...prev, ...nuevos]);
	};

	const quitar = (id: string) =>
		setArchivos((prev) => prev.filter((x) => x.id !== id));

	const mover = (i: number, dir: -1 | 1) =>
		setArchivos((prev) => {
			const arr = [...prev];
			const j = i + dir;
			if (j < 0 || j >= arr.length) return prev;
			[arr[i], arr[j]] = [arr[j], arr[i]];
			return arr;
		});

	// Une los PDFs en el orden de la lista y devuelve los bytes finales
	const construirPdf = async (): Promise<Uint8Array> => {
		const merged = await PDFDocument.create();
		for (const item of archivos) {
			const bytes = await item.file.arrayBuffer();
			const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
			const paginas = await merged.copyPages(src, src.getPageIndices());
			paginas.forEach((p) => merged.addPage(p));
		}
		return merged.save();
	};

	const unirYDescargar = async () => {
		if (archivos.length < 2) return;
		setUniendo(true);
		setError(null);
		try {
			const bytes = await construirPdf();
			const blob = new Blob([bytes as any], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'documento-unido.pdf';
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			setError(
				'No se pudo unir. Verificá que todos sean PDF válidos y no estén protegidos con contraseña.'
			);
		} finally {
			setUniendo(false);
		}
	};

	const guardarEnDocumentos = async () => {
		if (archivos.length < 2) return;
		setGuardando(true);
		setError(null);
		try {
			const bytes = await construirPdf();
			const blob = new Blob([bytes as any], { type: 'application/pdf' });
			const file = new File([blob], 'documento-unido.pdf', {
				type: 'application/pdf',
			});
			const fd = new FormData();
			fd.append('file', file);
			fd.append('sensitivity_level', 'medium');
			await uploadDocument(fd);
		} catch (e) {
			setError('No se pudo guardar en Documentos. Intentá de nuevo.');
			setGuardando(false);
		}
	};

	return (
		<div className="space-y-4">
			<label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50">
				<FilePlus2 className="h-8 w-8 text-slate-400" />
				<span className="text-sm font-medium text-slate-600">
					Elegí dos o más archivos PDF
				</span>
				<span className="text-xs text-slate-400">
					Se unen en el orden de la lista (podés reordenarlos)
				</span>
				<input
					type="file"
					accept="application/pdf"
					multiple
					className="hidden"
					onChange={(e) => {
						agregar(e.target.files);
						e.target.value = '';
					}}
				/>
			</label>

			{error && (
				<p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
					{error}
				</p>
			)}

			{archivos.length > 0 && (
				<>
					<div className="flex items-center justify-between">
						<span className="text-sm text-slate-500">
							{archivos.length} archivo(s)
						</span>
						<button
							onClick={() => setArchivos([])}
							className="text-sm font-medium text-slate-500 underline"
						>
							Limpiar todo
						</button>
					</div>

					<ul className="space-y-2">
						{archivos.map((item, i) => (
							<li
								key={item.id}
								className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
							>
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
									{i + 1}
								</span>
								<FileText className="h-5 w-5 shrink-0 text-sky-500" />
								<span className="flex-1 truncate text-sm text-slate-700">
									{item.nombre}
								</span>
								<button
									onClick={() => mover(i, -1)}
									className="rounded p-1 text-slate-500 hover:bg-slate-100"
									aria-label="Subir"
								>
									<ArrowUp className="h-4 w-4" />
								</button>
								<button
									onClick={() => mover(i, 1)}
									className="rounded p-1 text-slate-500 hover:bg-slate-100"
									aria-label="Bajar"
								>
									<ArrowDown className="h-4 w-4" />
								</button>
								<button
									onClick={() => quitar(item.id)}
									className="rounded p-1 text-rose-600 hover:bg-rose-50"
									aria-label="Quitar"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</li>
						))}
					</ul>

					<div className="flex flex-wrap items-center gap-3">
						<button
							onClick={unirYDescargar}
							disabled={archivos.length < 2 || uniendo}
							className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
						>
							{uniendo ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Download className="h-4 w-4" />
							)}
							{uniendo ? 'Uniendo…' : 'Unir y descargar'}
						</button>

						<button
							onClick={guardarEnDocumentos}
							disabled={archivos.length < 2 || guardando}
							className="inline-flex items-center gap-2 rounded-lg border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
						>
							{guardando ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<FolderPlus className="h-4 w-4" />
							)}
							{guardando ? 'Guardando…' : 'Guardar en Documentos'}
						</button>

						{archivos.length < 2 && (
							<span className="text-xs text-slate-400">
								Agregá al menos 2 PDF para unir
							</span>
						)}
					</div>
				</>
			)}
		</div>
	);
}
