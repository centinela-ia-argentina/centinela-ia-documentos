'use client';

import { useState } from 'react';
import { Coins, Hash, GitCompare, CalendarSearch, Copy, Check } from 'lucide-react';
import { montoALetras } from '@/lib/format/numeroALetras';

type Tab = 'montos' | 'contador' | 'comparar' | 'fechas';

function CopiarBtn({ texto }: { texto: string }) {
	const [ok, setOk] = useState(false);
	return (
		<button
			onClick={() => {
				navigator.clipboard.writeText(texto);
				setOk(true);
				setTimeout(() => setOk(false), 1500);
			}}
			className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
		>
			{ok ? <Check size={14} /> : <Copy size={14} />}
			{ok ? 'Copiado' : 'Copiar'}
		</button>
	);
}

function MontosALetras() {
	const [monto, setMonto] = useState('');
	const [moneda, setMoneda] = useState('PESOS');
	const [error, setError] = useState<string | null>(null);

	let salida = '';
	if (monto.trim()) {
		try {
			salida = montoALetras(monto, { moneda, mayusculas: true });
			if (error) setError(null);
		} catch (e: any) {
			salida = '';
		}
	}

	const handleMontoChange = (val: string) => {
		setMonto(val);
		if (!val.trim()) {
			setError(null);
			return;
		}
		try {
			montoALetras(val, { moneda, mayusculas: true });
			setError(null);
		} catch (err: any) {
			setError(err?.message || 'Formato de monto inválido');
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-3">
				<input
					className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
					inputMode="decimal"
					placeholder="Ej: 1.250.000,50 o 1234567.89"
					value={monto}
					onChange={(e) => handleMontoChange(e.target.value)}
				/>
				<select
					className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
					value={moneda}
					onChange={(e) => setMoneda(e.target.value)}
				>
					<option value="PESOS">Pesos</option>
					<option value="DÓLARES ESTADOUNIDENSES">Dólares</option>
					<option value="EUROS">Euros</option>
				</select>
			</div>
			{error && monto.trim() && (
				<p className="text-xs text-rose-500 font-medium">{error}</p>
			)}
			{salida && (
				<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
					<p className="text-sm font-medium text-slate-800">{salida}</p>
					<div className="mt-2"><CopiarBtn texto={salida} /></div>
				</div>
			)}
		</div>
	);
}

function Contador() {
	const [texto, setTexto] = useState('');
	const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
	const caracteres = texto.length;
	const sinEspacios = texto.replace(/\s/g, '').length;
	const oraciones = texto.split(/[.!?]+/).filter((s) => s.trim()).length;
	const parrafos = texto.split(/\n+/).filter((p) => p.trim()).length;
	const stats = [
		{ label: 'Palabras', valor: palabras },
		{ label: 'Caracteres', valor: caracteres },
		{ label: 'Sin espacios', valor: sinEspacios },
		{ label: 'Oraciones', valor: oraciones },
		{ label: 'Párrafos', valor: parrafos },
	];
	return (
		<div className="space-y-3">
			<textarea
				className="w-full min-h-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
				placeholder="Pegá o escribí tu texto…"
				value={texto}
				onChange={(e) => setTexto(e.target.value)}
			/>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
				{stats.map((s) => (
					<div key={s.label} className="rounded-lg border border-slate-200 p-3 text-center">
						<p className="text-lg font-semibold text-emerald-700">{s.valor}</p>
						<p className="text-xs text-slate-500">{s.label}</p>
					</div>
				))}
			</div>
		</div>
	);
}

function Comparar() {
	const [a, setA] = useState('');
	const [b, setB] = useState('');
	const [diff, setDiff] = useState<null | { tipo: 'igual' | 'add' | 'del'; texto: string }[]>(null);

	const comparar = () => {
		const la = a.split('\n');
		const lb = b.split('\n');
		const m = la.length, n = lb.length;
		const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
		for (let i = m - 1; i >= 0; i--)
			for (let j = n - 1; j >= 0; j--)
				dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		const out: { tipo: 'igual' | 'add' | 'del'; texto: string }[] = [];
		let i = 0, j = 0;
		while (i < m && j < n) {
			if (la[i] === lb[j]) { out.push({ tipo: 'igual', texto: la[i] }); i++; j++; }
			else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ tipo: 'del', texto: la[i] }); i++; }
			else { out.push({ tipo: 'add', texto: lb[j] }); j++; }
		}
		while (i < m) { out.push({ tipo: 'del', texto: la[i] }); i++; }
		while (j < n) { out.push({ tipo: 'add', texto: lb[j] }); j++; }
		setDiff(out);
	};

	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-2">
				<textarea className="min-h-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Texto original…" value={a} onChange={(e) => setA(e.target.value)} />
				<textarea className="min-h-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Texto modificado…" value={b} onChange={(e) => setB(e.target.value)} />
			</div>
			<button onClick={comparar} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Comparar</button>
			{diff && (
				<div className="rounded-lg border border-slate-200 p-3 font-mono text-xs leading-relaxed">
					{diff.map((d, k) => (
						<div key={k} className={d.tipo === 'add' ? 'bg-emerald-50 text-emerald-800' : d.tipo === 'del' ? 'bg-rose-50 text-rose-700 line-through' : 'text-slate-600'}>
							<span className="select-none opacity-50">{d.tipo === 'add' ? '+ ' : d.tipo === 'del' ? '- ' : '  '}</span>
							{d.texto || '\u00A0'}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function ExtraerFechas() {
	const [texto, setTexto] = useState('');
	const [fechas, setFechas] = useState<null | string[]>(null);

	const extraer = () => {
		const encontradas: string[] = [];
		const num = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;
		let mm;
		while ((mm = num.exec(texto)) !== null) {
			const d = mm[1].padStart(2, '0');
			const m = mm[2].padStart(2, '0');
			let y = mm[3];
			if (y.length === 2) y = '20' + y;
			encontradas.push(`${d}/${m}/${y}`);
		}
		const txt = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')})\\s+de\\s+(\\d{4})\\b`, 'gi');
		while ((mm = txt.exec(texto)) !== null) {
			const d = mm[1].padStart(2, '0');
			const m = String(MESES.indexOf(mm[2].toLowerCase()) + 1).padStart(2, '0');
			encontradas.push(`${d}/${m}/${mm[3]}`);
		}
		setFechas([...new Set(encontradas)]);
	};

	return (
		<div className="space-y-3">
			<textarea className="w-full min-h-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Pegá el texto de una cédula, escrito o resolución…" value={texto} onChange={(e) => setTexto(e.target.value)} />
			<button onClick={extraer} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Extraer fechas</button>
			{fechas && (
				fechas.length > 0 ? (
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<div className="flex flex-wrap gap-2">
							{fechas.map((f) => (
								<span key={f} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">{f}</span>
							))}
						</div>
						<div className="mt-3"><CopiarBtn texto={fechas.join('\n')} /></div>
					</div>
				) : (
					<p className="text-sm text-slate-500">No se encontraron fechas (formatos dd/mm/aaaa o “12 de agosto de 2026”).</p>
				)
			)}
		</div>
	);
}

export function UtilidadesTexto() {
	const [tab, setTab] = useState<Tab>('montos');
	const tabs = [
		{ id: 'montos' as Tab, label: 'Montos a letras', icon: Coins },
		{ id: 'contador' as Tab, label: 'Contador', icon: Hash },
		{ id: 'comparar' as Tab, label: 'Comparar textos', icon: GitCompare },
		{ id: 'fechas' as Tab, label: 'Extraer fechas', icon: CalendarSearch },
	];
	return (
		<section className="rounded-2xl border border-slate-200 p-5">
			<h2 className="text-lg font-semibold text-slate-800">Utilidades de texto</h2>
			<p className="mb-4 text-sm text-slate-500">Herramientas rápidas para redactar y revisar escritos. Todo se procesa en tu navegador.</p>
			<div className="mb-4 flex flex-wrap gap-2">
				{tabs.map((t) => {
					const Icon = t.icon;
					return (
						<button
							key={t.id}
							onClick={() => setTab(t.id)}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === t.id ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
						>
							<Icon size={16} />
							{t.label}
						</button>
					);
				})}
			</div>
			{tab === 'montos' && <MontosALetras />}
			{tab === 'contador' && <Contador />}
			{tab === 'comparar' && <Comparar />}
			{tab === 'fechas' && <ExtraerFechas />}
		</section>
	);
}
