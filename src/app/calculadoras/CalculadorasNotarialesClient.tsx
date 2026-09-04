'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Calculator, Landmark, Receipt, Coins, Info } from 'lucide-react';

// --- Helpers ---
const currency = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400';

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// --- Valores por defecto (orientativos, CABA — editables) ---
const DEFAULT_SELLOS = 3.6; // % Impuesto de Sellos (compraventa inmueble)
const DEFAULT_ITI = 1.5; // % ITI (personas humanas, inmuebles pre-2018)
const DEFAULT_HONORARIOS = 1.5; // % honorarios notariales orientativo
const DEFAULT_APORTE = 10; // % aporte Colegio/Caja sobre honorarios
const IVA = 21; // % IVA sobre honorarios (si responsable inscripto)

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      <div className="relative">
        <input
          inputMode="decimal"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Result({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 ${
        strong ? 'bg-cyan-400/10' : 'bg-white/[0.02]'
      }`}
    >
      <span className={`text-sm ${strong ? 'font-semibold text-cyan-300' : 'text-slate-300'}`}>
        {label}
      </span>
      <span className={`text-sm ${strong ? 'font-bold text-cyan-200' : 'font-medium text-white'}`}>
        {value}
      </span>
    </div>
  );
}

type Tab = 'escritura' | 'sellos' | 'iti' | 'aranceles';

export function CalculadorasNotarialesClient() {
  const [tab, setTab] = useState<Tab>('escritura');
  const tabs: Array<{ id: Tab; label: string; icon: typeof Calculator }> = [
    { id: 'escritura', label: 'Costo de escritura', icon: Calculator },
    { id: 'sellos', label: 'Impuesto de Sellos', icon: Landmark },
    { id: 'iti', label: 'ITI', icon: Receipt },
    { id: 'aranceles', label: 'Honorarios y aportes', icon: Coins },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
          Herramientas notariales
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Calculadoras</h1>
        <p className="mt-1 text-sm text-slate-400">
          Estimaciones orientativas de los costos de una escritura (CABA).
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200/80">
          Resultados estimativos y no vinculantes. Las alícuotas de sellos, ITI y aranceles cambian y
          varían por jurisdicción: verificá siempre los valores vigentes con el Colegio de Escribanos y
          la normativa fiscal antes de informar a un cliente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'escritura' && <EscrituraCalc />}
      {tab === 'sellos' && <SellosCalc />}
      {tab === 'iti' && <ItiCalc />}
      {tab === 'aranceles' && <ArancelesCalc />}
    </div>
  );
}

function EscrituraCalc() {
  const [monto, setMonto] = useState('');
  const [sellosAlic, setSellosAlic] = useState(String(DEFAULT_SELLOS));
  const [itiAlic, setItiAlic] = useState(String(DEFAULT_ITI));
  const [honAlic, setHonAlic] = useState(String(DEFAULT_HONORARIOS));
  const [aporteAlic, setAporteAlic] = useState(String(DEFAULT_APORTE));
  const [conIti, setConIti] = useState(false);
  const [conIva, setConIva] = useState(false);

  const base = num(monto);
  const sellos = base * (num(sellosAlic) / 100);
  const iti = conIti ? base * (num(itiAlic) / 100) : 0;
  const honorarios = base * (num(honAlic) / 100);
  const aporte = honorarios * (num(aporteAlic) / 100);
  const iva = conIva ? honorarios * (IVA / 100) : 0;
  const total = sellos + iti + honorarios + aporte + iva;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Datos de la operación"
        subtitle="Cargá el valor y ajustá las alícuotas según la jurisdicción y el caso."
      >
        <Field label="Valor de la operación" value={monto} onChange={setMonto} suffix="ARS" placeholder="Ej: 85000000" />
        <Field label="Impuesto de Sellos" value={sellosAlic} onChange={setSellosAlic} suffix="%" />
        <Field label="Honorarios notariales" value={honAlic} onChange={setHonAlic} suffix="%" />
        <Field label="Aporte Colegio/Caja (sobre honorarios)" value={aporteAlic} onChange={setAporteAlic} suffix="%" />
        <Field label="ITI" value={itiAlic} onChange={setItiAlic} suffix="%" />
        <Check checked={conIti} onChange={setConIti}>
          Incluir ITI (solo para actos previos al 08/07/2024 — derogado por Ley 27.743 art. 67)
        </Check>
        <Check checked={conIva} onChange={setConIva}>
          Sumar IVA 21% sobre honorarios
        </Check>
      </Card>

      <Card title="Estimación de costos" subtitle="Desglose orientativo del cierre de la escritura.">
        <Result label="Impuesto de Sellos" value={currency(sellos)} />
        {conIti && <Result label="ITI" value={currency(iti)} />}
        <Result label="Honorarios notariales" value={currency(honorarios)} />
        <Result label="Aporte Colegio/Caja" value={currency(aporte)} />
        {conIva && <Result label="IVA 21%" value={currency(iva)} />}
        <Result label="Total estimado de gastos" value={currency(total)} strong />
      </Card>
    </div>
  );
}

function SellosCalc() {
  const [monto, setMonto] = useState('');
  const [alic, setAlic] = useState(String(DEFAULT_SELLOS));
  const [dividir, setDividir] = useState(true);
  const total = num(monto) * (num(alic) / 100);
  return (
    <Card
      title="Impuesto de Sellos (CABA)"
      subtitle="Compraventa de inmueble. Se calcula sobre el mayor valor entre el precio y la valuación fiscal."
    >
      <Field label="Valor de la operación" value={monto} onChange={setMonto} suffix="ARS" placeholder="Ej: 85000000" />
      <Field label="Alícuota" value={alic} onChange={setAlic} suffix="%" />
      <Check checked={dividir} onChange={setDividir}>
        Dividir 50/50 entre comprador y vendedor
      </Check>
      <Result label="Sellos total" value={currency(total)} strong />
      {dividir && <Result label="A cargo de cada parte" value={currency(total / 2)} />}
    </Card>
  );
}

function ItiCalc() {
  const [monto, setMonto] = useState('');
  const [alic, setAlic] = useState(String(DEFAULT_ITI));
  const total = num(monto) * (num(alic) / 100);
  return (
    <Card
      title="ITI — Impuesto a la Transferencia de Inmuebles"
      subtitle="Aplica a personas humanas que venden inmuebles no alcanzados por Impuesto a las Ganancias (adquiridos antes del 01/01/2018)."
    >
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
        ⚠️ <strong>Atención normativa:</strong> El art. 67 de la Ley 27.743 (B.O. 08/07/2024) derogó el Título VII de la Ley 23.905 (Impuesto a la Transferencia de Inmuebles - ITI) para las transferencias y operaciones formalizadas a partir del 8 de julio de 2024. Este cálculo se conserva como referencia histórica para operaciones formalizadas u obligaciones devengadas con anterioridad a dicha fecha.
      </div>
      <Field label="Valor de transferencia" value={monto} onChange={setMonto} suffix="ARS" placeholder="Ej: 85000000" />
      <Field label="Alícuota" value={alic} onChange={setAlic} suffix="%" />
      <Result label="ITI estimado" value={currency(total)} strong />
    </Card>
  );
}

function ArancelesCalc() {
  const [monto, setMonto] = useState('');
  const [hon, setHon] = useState(String(DEFAULT_HONORARIOS));
  const [aporte, setAporte] = useState(String(DEFAULT_APORTE));
  const [conIva, setConIva] = useState(false);
  const honorarios = num(monto) * (num(hon) / 100);
  const aporteMonto = honorarios * (num(aporte) / 100);
  const ivaMonto = conIva ? honorarios * (IVA / 100) : 0;
  const total = honorarios + aporteMonto + ivaMonto;
  return (
    <Card
      title="Honorarios y aportes notariales"
      subtitle="Honorario orientativo sobre el valor de la operación, más aporte al Colegio/Caja."
    >
      <Field label="Valor de la operación" value={monto} onChange={setMonto} suffix="ARS" placeholder="Ej: 85000000" />
      <Field label="Honorarios" value={hon} onChange={setHon} suffix="%" />
      <Field label="Aporte Colegio/Caja (sobre honorarios)" value={aporte} onChange={setAporte} suffix="%" />
      <Check checked={conIva} onChange={setConIva}>
        Sumar IVA 21% sobre honorarios (responsable inscripto)
      </Check>
      <Result label="Honorarios" value={currency(honorarios)} />
      <Result label="Aporte Colegio/Caja" value={currency(aporteMonto)} />
      {conIva && <Result label="IVA 21%" value={currency(ivaMonto)} />}
      <Result label="Total honorarios + aportes" value={currency(total)} strong />
    </Card>
  );
}
