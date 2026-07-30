'use client';

import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarClock, Coins, Scale, AlertTriangle, CalendarPlus, Check, Loader2, Briefcase, TrendingUp, Users, Gavel, Hourglass, Siren, HeartPulse, MapPin, Percent } from 'lucide-react';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { guardarPlazoEnAgenda } from './actions';
import { UMA_VALOR, UMA_VIGENCIA, TASA_JUSTICIA_PORCENTAJE, UHOM_VALOR, JUS_BA_MEDIACION, JUS_CORRIENTES, LegalJurisdiction, LEGAL_CALENDARS, JURISDICTION_LABELS } from '@/lib/legal/config';
import { parseISODate, sumarDiasCorridos, calcularVencimientoProcesal, esDiaHabilJudicial } from '@/lib/legal/plazos';

type Tab = 'plazos' | 'honorarios' | 'tasa' | 'laboral' | 'intereses' | 'alimentos' | 'danos' | 'caducidad' | 'punitivos' | 'incapacidad' | 'distancia' | 'prorrateo' | 'mediacion';

const currency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

// Parsea un monto en formato argentino (admite puntos de mil y coma decimal): "1.000.000,50" -> 1000000.5
const parseMonto = (str: string): number => {
  if (!str) return NaN;
  const limpio = str.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(limpio);
};

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateLarga = (d: Date) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400';
const btnClass =
  'mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-brandviolet px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed';

function Card({ title, subtitle, children, index = 0 }: { title: string; subtitle?: string; children: ReactNode; index?: number }) {
  return (
    <MotionCard index={index} className="p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </MotionCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function RadioPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        active ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400' : 'border-white/10 bg-transparent text-slate-400 hover:bg-white/[0.04]'
      }`}
    >
      {label}
    </button>
  );
}

function ResultBox({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02]'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function PlazosCalc({ puedeGuardar = true }: { puedeGuardar?: boolean }) {
  const [jurisdiccion, setJurisdiccion] = useState<LegalJurisdiction | ''>('');
  const [fecha, setFecha] = useState('');
  const [dias, setDias] = useState('');
  const [tipo, setTipo] = useState<'habiles' | 'corridos'>('habiles');
  const [resultado, setResultado] = useState<{ vencimiento: Date; texto: string; adv: string; fuente: string; calAnio: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setResultado(null);
    setGuardado(null);
    if (!jurisdiccion) return setError('Seleccioná una jurisdicción.');
    const cal = LEGAL_CALENDARS[jurisdiccion as LegalJurisdiction];
    if (cal.coverage !== 'verified') return setError('Calendario todavía no configurado para esta jurisdicción/año.');

    const inicio = parseISODate(fecha);
    const n = parseInt(dias, 10);
    if (!inicio) return setError('Ingresá una fecha de inicio válida.');
    if (!Number.isFinite(n) || n <= 0) return setError('Ingresá una cantidad de días mayor a cero.');

    if (tipo === 'corridos') {
      const venc = sumarDiasCorridos(inicio, n);
      setResultado({
        vencimiento: venc,
        texto: `${n} días corridos`,
        adv: 'Estimación orientativa.',
        fuente: 'Días corridos',
        calAnio: venc.getFullYear()
      });
      return;
    }

    const res = calcularVencimientoProcesal({
      fechaNotificacion: fecha,
      diasHabiles: n,
      jurisdiccion: jurisdiccion as LegalJurisdiction,
      kmDistancia: 0,
    });

    if (!res.ok) {
      if (res.motivo === 'jurisdiccion_requerida') return setError('Seleccioná una jurisdicción.');
      if (res.motivo === 'calendario_no_disponible') return setError('Calendario todavía no configurado para esta jurisdicción/año.');
      if (res.motivo === 'anio_no_cubierto') return setError('El año de la fecha o del vencimiento no está cubierto por el calendario.');
      if (res.motivo === 'fecha_invalida') return setError('Ingresá una fecha válida.');
      return setError('Error en el cálculo.');
    }

    const [y, m, d] = res.vencimiento.split('-');
    const vencimientoObj = new Date(Number(y), Number(m) - 1, Number(d));

    setResultado({
      vencimiento: vencimientoObj,
      texto: `${n} día${n > 1 ? 's' : ''} hábiles judiciales`,
      adv: res.advertencia,
      fuente: res.fuente,
      calAnio: res.calendarioAnio
    });
  };

  const cargarAgenda = async () => {
    if (!resultado) return;
    setGuardando(true);
    setGuardado(null);
    const res = await guardarPlazoEnAgenda({
      titulo: referencia.trim() || 'Vencimiento de plazo procesal',
      fecha: toISODate(resultado.vencimiento),
      detalle: `${resultado.texto} (${JURISDICTION_LABELS[jurisdiccion as LegalJurisdiction]}) — Fuente: ${resultado.fuente}`,
    });
    setGuardando(false);
    setGuardado(
      res.ok
        ? '✓ Cargado a la agenda'
        : res.motivo === 'no_auth'
          ? 'Iniciá sesión para guardar.'
          : 'No se pudo guardar, intentá de nuevo.'
    );
    if (res.ok) setReferencia('');
  };

  return (
    <Card title="Plazos procesales" subtitle="Calculá la fecha de vencimiento desde una fecha de inicio.">
      <div className="mb-4">
        <Field label="Jurisdicción (obligatorio)">
          <select
            value={jurisdiccion}
            onChange={(e) => setJurisdiccion(e.target.value as LegalJurisdiction | '')}
            className={inputClass}
          >
            <option value="">-- Seleccionar jurisdicción --</option>
            {Object.entries(JURISDICTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        {jurisdiccion && (
          <div className="mt-2 text-xs text-slate-400">
            {LEGAL_CALENDARS[jurisdiccion as LegalJurisdiction].coverage === 'verified' ? (
              <span className="text-emerald-400">✓ Calendario verificado para el año {LEGAL_CALENDARS[jurisdiccion as LegalJurisdiction].year} (actualizado el {LEGAL_CALENDARS[jurisdiccion as LegalJurisdiction].verifiedAt})</span>
            ) : (
              <span className="text-amber-400">⚠️ Calendario todavía no configurado para esta jurisdicción/año</span>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de inicio (notificación)">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Cantidad de días">
          <input type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Ej: 5" className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 flex gap-2">
        <RadioPill active={tipo === 'habiles'} onClick={() => setTipo('habiles')} label="Días hábiles" />
        <RadioPill active={tipo === 'corridos'} onClick={() => setTipo('corridos')} label="Días corridos" />
      </div>

      <MotionButton type="button" onClick={calcular} className={btnClass}>Calcular vencimiento</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {resultado && (
        <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Vencimiento</p>
          <p className="mt-1 text-lg font-semibold capitalize text-white">{formatDateLarga(resultado.vencimiento)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Contados {resultado.texto}
            {tipo === 'habiles' ? ' (sin fines de semana, feriados ni feria judicial).' : '.'}
          </p>
          {tipo === 'habiles' && (
            <div className="mt-2 text-[11px] text-amber-200">
              ⚠️ {resultado.adv} | {JURISDICTION_LABELS[jurisdiccion as LegalJurisdiction]} ({resultado.calAnio}) — Fuente: {resultado.fuente}
            </div>
          )}

          {puedeGuardar && (
            <div className="mt-4 border-t border-emerald-100 pt-4">
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Referencia (ej. carátula o trámite)"
                className={inputClass}
              />
              <MotionButton
                type="button"
                onClick={cargarAgenda}
                disabled={guardando}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Cargar a la agenda
              </MotionButton>
              {guardado && (
                <p className={`mt-2 text-center text-[11px] font-medium ${guardado.startsWith('✓') ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {guardado}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// 📊 Escala del art. 21 Ley 27.423 (acumulativa por tramos de UMA)
const ESCALA_ART21: Array<{ hastaUMA: number; min: number; max: number }> = [
  { hastaUMA: 15, min: 22, max: 33 },
  { hastaUMA: 45, min: 20, max: 26 },
  { hastaUMA: 90, min: 18, max: 24 },
  { hastaUMA: 150, min: 17, max: 22 },
  { hastaUMA: 450, min: 15, max: 20 },
  { hastaUMA: 750, min: 13, max: 17 },
  { hastaUMA: Infinity, min: 12, max: 15 },
];

function calcularEscalaArt21(monto: number) {
  const montoUMA = Math.floor(monto / UMA_VALOR); // las fracciones decimales se eliminan
  let hMin = 0;
  let hMax = 0;
  let prevUMA = 0;
  for (const tramo of ESCALA_ART21) {
    if (montoUMA <= prevUMA) break;
    const topeUMA = Math.min(montoUMA, tramo.hastaUMA);
    const porcionPesos = (topeUMA - prevUMA) * UMA_VALOR;
    hMin += porcionPesos * (tramo.min / 100);
    hMax += porcionPesos * (tramo.max / 100);
    prevUMA = tramo.hastaUMA;
    if (montoUMA <= tramo.hastaUMA) break;
  }
  const tramo =
    ESCALA_ART21.find((t) => montoUMA <= t.hastaUMA) ??
    ESCALA_ART21[ESCALA_ART21.length - 1];
  return { montoUMA, hMin, hMax, tramoMin: tramo.min, tramoMax: tramo.max };
}

type Instancia = 'primera' | 'segunda_conf' | 'segunda_rev';
type Caracter = 'patrocinante' | 'apoderado' | 'procurador';

function HonorariosCalc() {
  const [monto, setMonto] = useState('');
  const [instancia, setInstancia] = useState<Instancia>('primera');
  const [caracter, setCaracter] = useState<Caracter>('patrocinante');
  const [res, setRes] = useState<{
    montoUMA: number;
    tramoMin: number;
    tramoMax: number;
    hMin: number;
    hMax: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const m = parseMonto(monto);
    if (!Number.isFinite(m) || m <= 0)
      return setError('Ingresá un monto del proceso (base regulatoria) válido.');

    const base = calcularEscalaArt21(m);
    let hMin = base.hMin;
    let hMax = base.hMax;

    // Ajuste por instancia (art. 30)
    if (instancia === 'segunda_conf') {
      hMin = base.hMin * 0.3;
      hMax = base.hMax * 0.35;
    } else if (instancia === 'segunda_rev') {
      hMin = base.hMin * 0.3;
      hMax = base.hMax * 0.4;
    }

    // Ajuste por carácter (art. 20)
    const factor = caracter === 'apoderado' ? 1.4 : caracter === 'procurador' ? 0.4 : 1;
    hMin *= factor;
    hMax *= factor;

    setRes({ montoUMA: base.montoUMA, tramoMin: base.tramoMin, tramoMax: base.tramoMax, hMin, hMax });
  };

  return (
    <Card
      title="Honorarios (Ley 27.423)"
      subtitle="Escala acumulativa del art. 21 sobre la base regulatoria. Orientativo."
    >
      <Field label="Monto del proceso / base regulatoria">
        <input value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 10.000.000" className={inputClass} />
      </Field>

      <Field label="Instancia">
        <div className="flex flex-wrap gap-2">
          <RadioPill active={instancia === 'primera'} onClick={() => setInstancia('primera')} label="Primera instancia" />
          <RadioPill active={instancia === 'segunda_conf'} onClick={() => setInstancia('segunda_conf')} label="2ª inst. (confirmada)" />
          <RadioPill active={instancia === 'segunda_rev'} onClick={() => setInstancia('segunda_rev')} label="2ª inst. (revocada)" />
        </div>
      </Field>

      <Field label="Carácter del profesional">
        <div className="flex flex-wrap gap-2">
          <RadioPill active={caracter === 'patrocinante'} onClick={() => setCaracter('patrocinante')} label="Abogado/a patrocinante" />
          <RadioPill active={caracter === 'apoderado'} onClick={() => setCaracter('apoderado')} label="Apoderado/a sin patrocinio" />
          <RadioPill active={caracter === 'procurador'} onClick={() => setCaracter('procurador')} label="Procurador/a" />
        </div>
      </Field>

      <p className="mt-4 text-xs text-slate-500">
        UMA vigente: {currency(UMA_VALOR)} ({UMA_VIGENCIA}). La escala del art. 21 es acumulativa
        (cada tramo de UMA se calcula con su alícuota). 2ª instancia = 30–35% de lo de 1ª si se
        confirma; 30–40% si se revoca. Apoderado sin patrocinio = 140%; procurador = 40% (art. 20).
      </p>

      <MotionButton onClick={calcular} className={btnClass}>Calcular honorarios</MotionButton>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {res && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox label="Base en UMA" value={`${res.montoUMA} UMA`} subtitle={`Tramo art. 21: ${res.tramoMin}% – ${res.tramoMax}%`} />
          <ResultBox label="Equivalente en UMA (honorario)" value={`${Math.floor(res.hMin / UMA_VALOR)} – ${Math.floor(res.hMax / UMA_VALOR)} UMA`} />
          <div className="sm:col-span-2">
            <ResultBox label="Honorarios estimados" value={`${currency(res.hMin)} — ${currency(res.hMax)}`} subtitle="Rango mínimo–máximo de la escala legal" highlight />
          </div>
        </div>
      )}
    </Card>
  );
}

function TasaCalc() {
  const [montoTasa, setMontoTasa] = useState('');
  const [tasaRes, setTasaRes] = useState<number | null>(null);
  const [capital, setCapital] = useState('');
  const [tasaAnual, setTasaAnual] = useState('');
  const [diasInteres, setDiasInteres] = useState('');
  const [intRes, setIntRes] = useState<null | { interes: number; total: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcularTasa = () => {
    setError(null);
    setTasaRes(null);
    const m = parseMonto(montoTasa);
    if (!Number.isFinite(m) || m <= 0) return setError('Ingresá un monto válido para la tasa de justicia.');
    setTasaRes(m * (TASA_JUSTICIA_PORCENTAJE / 100));
  };

  const calcularInteres = () => {
    setError(null);
    setIntRes(null);
    const c = parseMonto(capital);
    const t = parseFloat(tasaAnual);
    const d = parseInt(diasInteres, 10);
    if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(t) || t <= 0 || !Number.isFinite(d) || d <= 0)
      return setError('Completá capital, tasa anual y días con valores válidos.');
    const interes = c * (t / 100) * (d / 365);
    setIntRes({ interes, total: c + interes });
  };

  return (
    <div className="space-y-6">
      <Card title="Tasa de justicia" subtitle={`Ley 23.898 — ${TASA_JUSTICIA_PORCENTAJE}% del monto del proceso (Nación).`}>
        <Field label="Monto del proceso ($)">
          <input type="text" inputMode="decimal" value={montoTasa} onChange={(e) => setMontoTasa(e.target.value)} placeholder="Ej: 1.000.000" className={inputClass} />
        </Field>
        <MotionButton type="button" onClick={calcularTasa} className={btnClass}>Calcular tasa</MotionButton>
        {tasaRes !== null && (
          <div className="mt-4">
            <ResultBox label={`Tasa de justicia (${TASA_JUSTICIA_PORCENTAJE}%)`} value={currency(tasaRes)} highlight />
          </div>
        )}
      </Card>

      <Card title="Intereses" subtitle="Interés simple: capital × tasa anual × (días / 365).">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Capital ($)">
            <input type="text" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Ej: 1.000.000" className={inputClass} />
          </Field>
          <Field label="Tasa anual (%)">
            <input type="number" min={0} step="0.1" value={tasaAnual} onChange={(e) => setTasaAnual(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Días">
            <input type="number" min={0} value={diasInteres} onChange={(e) => setDiasInteres(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <MotionButton type="button" onClick={calcularInteres} className={btnClass}>Calcular intereses</MotionButton>
        {intRes && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultBox label="Interés" value={currency(intRes.interes)} />
            <ResultBox label="Capital + interés" value={currency(intRes.total)} highlight />
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

// ── 💼 Liquidación laboral / despido ────────────────────────────
function LiquidacionLaboralCalc() {
  const [remun, setRemun] = useState('');
  const [ingreso, setIngreso] = useState('');
  const [egreso, setEgreso] = useState('');
  const [res, setRes] = useState<null | {
    anios: number; meses: number; aniosComputables: number;
    antiguedad: number; preaviso: number; integracion: number;
    sac: number; vacaciones: number; total: number;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const base = parseMonto(remun);
    const dIng = parseISODate(ingreso);
    const dEg = parseISODate(egreso);
    if (!Number.isFinite(base) || base <= 0) return setError('Ingresá la mejor remuneración mensual, normal y habitual.');
    if (!dIng || !dEg) return setError('Ingresá fechas de ingreso y egreso válidas.');
    if (dEg <= dIng) return setError('La fecha de egreso debe ser posterior a la de ingreso.');

    let anios = dEg.getFullYear() - dIng.getFullYear();
    let meses = dEg.getMonth() - dIng.getMonth();
    if (dEg.getDate() < dIng.getDate()) meses -= 1;
    if (meses < 0) { anios -= 1; meses += 12; }

    const aniosComputables = Math.max(1, anios + (meses > 3 ? 1 : 0));
    const antiguedad = base * aniosComputables;

    const preavisoMeses = anios >= 5 ? 2 : 1;
    const preavisoBase = base * preavisoMeses;
    const preaviso = preavisoBase + preavisoBase / 12;

    const diasMes = new Date(dEg.getFullYear(), dEg.getMonth() + 1, 0).getDate();
    const integracionBase = (base / diasMes) * (diasMes - dEg.getDate());
    const integracion = integracionBase + integracionBase / 12;

    const mesSemestre = dEg.getMonth() % 6;
    const inicioSemestre = new Date(dEg.getFullYear(), dEg.getMonth() - mesSemestre, 1);
    const diasSemestre = (dEg.getTime() - inicioSemestre.getTime()) / 86400000;
    const sac = (base / 2) * (diasSemestre / 182);

    const diasVac = anios >= 20 ? 35 : anios >= 10 ? 28 : anios >= 5 ? 21 : 14;
    const inicioAnio = new Date(dEg.getFullYear(), 0, 1);
    const diasAnio = (dEg.getTime() - inicioAnio.getTime()) / 86400000;
    const vacaciones = (base / 25) * (diasVac * (diasAnio / 365));

    const total = antiguedad + preaviso + integracion + sac + vacaciones;
    setRes({ anios, meses, aniosComputables, antiguedad, preaviso, integracion, sac, vacaciones, total });
  };

  return (
    <Card title="Liquidación por despido sin causa" subtitle="Estimación de rubros indemnizatorios (LCT 20.744). Orientativo — no incluye topes ni multas.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Mejor remuneración mensual">
          <input value={remun} onChange={(e) => setRemun(e.target.value)} placeholder="Ej: 800.000" className={inputClass} />
        </Field>
        <Field label="Fecha de ingreso">
          <input type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fecha de egreso">
          <input type="date" value={egreso} onChange={(e) => setEgreso(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular liquidación</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-600">
            Antigüedad: <strong>{res.anios} año{res.anios !== 1 ? 's' : ''} y {res.meses} mes{res.meses !== 1 ? 'es' : ''}</strong>{' '}
            (se computan {res.aniosComputables} para el art. 245).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultBox label="Indemnización por antigüedad (art. 245)" value={currency(res.antiguedad)} />
            <ResultBox label="Preaviso + SAC" value={currency(res.preaviso)} />
            <ResultBox label="Integración mes de despido + SAC" value={currency(res.integracion)} />
            <ResultBox label="SAC proporcional" value={currency(res.sac)} />
            <ResultBox label="Vacaciones no gozadas" value={currency(res.vacaciones)} />
            <ResultBox label="TOTAL estimado" value={currency(res.total)} highlight />
          </div>
        </div>
      )}
    </Card>
  );
}

// ── 📈 Intereses judiciales ─────────────────────────────────────
function InteresesJudicialesCalc() {
  const [capital, setCapital] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tasaTipo, setTasaTipo] = useState<'activa' | 'pasiva' | 'otra'>('activa');
  const [tasa, setTasa] = useState('');
  const [res, setRes] = useState<null | { dias: number; interes: number; total: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const c = parseMonto(capital);
    const dDesde = parseISODate(desde);
    const dHasta = parseISODate(hasta);
    const t = parseFloat(tasa);
    if (!Number.isFinite(c) || c <= 0) return setError('Ingresá un capital válido.');
    if (!dDesde || !dHasta) return setError('Ingresá el período (desde / hasta).');
    if (dHasta <= dDesde) return setError('La fecha "hasta" debe ser posterior a "desde".');
    if (!Number.isFinite(t) || t <= 0) return setError('Ingresá la tasa anual (%) a aplicar.');
    const dias = Math.round((dHasta.getTime() - dDesde.getTime()) / 86400000);
    const interes = c * (t / 100) * (dias / 365);
    setRes({ dias, interes, total: c + interes });
  };

  return (
    <Card title="Intereses judiciales" subtitle="Interés simple sobre un capital, por período. La tasa se carga a mano (verificá BCRA / fuero).">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Capital"><input value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Ej: 1.000.000" className={inputClass} /></Field>
        <Field label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputClass} /></Field>
        <Field label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputClass} /></Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RadioPill active={tasaTipo === 'activa'} onClick={() => setTasaTipo('activa')} label="Tasa activa" />
        <RadioPill active={tasaTipo === 'pasiva'} onClick={() => setTasaTipo('pasiva')} label="Tasa pasiva" />
        <RadioPill active={tasaTipo === 'otra'} onClick={() => setTasaTipo('otra')} label="Otra" />
      </div>

      <div className="mt-4">
        <Field label="Tasa anual a aplicar (%)">
          <input value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="Ej: 90" className={inputClass} />
        </Field>
        <p className="mt-1 text-xs text-slate-500">
          Elegí el tipo de tasa según el fuero y cargá el valor anual vigente (BCRA). El cálculo usa interés simple.
        </p>
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular intereses</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultBox label="Días" value={String(res.dias)} />
          <ResultBox label="Intereses" value={currency(res.interes)} />
          <ResultBox label="Capital + intereses" value={currency(res.total)} highlight />
        </div>
      )}
    </Card>
  );
}

// ── 👨👩👧 Cuota alimentaria ─────────────────────────────────────
function CuotaAlimentariaCalc() {
  const [ingresos, setIngresos] = useState('');
  const [porcentaje, setPorcentaje] = useState('20');
  const [hijos, setHijos] = useState('1');
  const [res, setRes] = useState<null | { cuota: number; porHijo: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const i = parseMonto(ingresos);
    const p = parseFloat(porcentaje);
    const h = parseInt(hijos, 10);
    if (!Number.isFinite(i) || i <= 0) return setError('Ingresá los ingresos netos del/de la alimentante.');
    if (!Number.isFinite(p) || p <= 0) return setError('Ingresá un porcentaje válido.');
    if (!Number.isFinite(h) || h <= 0) return setError('Ingresá la cantidad de hijos/as.');
    const cuota = i * (p / 100);
    setRes({ cuota, porHijo: cuota / h });
  };

  return (
    <Card title="Cuota alimentaria" subtitle="Estimación por porcentaje de ingresos. No hay porcentaje legal fijo; lo determina el juez.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ingresos netos mensuales"><input value={ingresos} onChange={(e) => setIngresos(e.target.value)} placeholder="Ej: 900.000" className={inputClass} /></Field>
        <Field label="Porcentaje (%)"><input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className={inputClass} /></Field>
        <Field label="Cantidad de hijos/as"><input value={hijos} onChange={(e) => setHijos(e.target.value)} className={inputClass} /></Field>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Referencia orientativa: la jurisprudencia suele ubicar la cuota entre el 20% y 30% para un hijo/a, aumentando con la cantidad de hijos/as y las necesidades acreditadas.
      </p>

      <MotionButton onClick={calcular} className={btnClass}>Calcular cuota</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox label="Cuota mensual estimada" value={currency(res.cuota)} highlight />
          <ResultBox label="Equivalente por hijo/a" value={currency(res.porHijo)} />
        </div>
      )}
    </Card>
  );
}

// ── ⚖️ Cuantificación de daños ──────────────────────────────────
function DanosCalc() {
  const [emergente, setEmergente] = useState('');
  const [lucro, setLucro] = useState('');
  const [moral, setMoral] = useState('');
  const [otros, setOtros] = useState('');
  const [interes, setInteres] = useState('');
  const [res, setRes] = useState<null | { subtotal: number; interesMonto: number; total: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const val = (s: string) => (Number.isFinite(parseMonto(s)) ? parseMonto(s) : 0);
    const e = val(emergente);
    const l = val(lucro);
    const m = val(moral);
    const o = val(otros);
    const pInt = parseFloat(interes);
    const subtotal = e + l + m + o;
    if (subtotal <= 0) return setError('Cargá al menos un rubro de daño.');
    const interesMonto = Number.isFinite(pInt) && pInt > 0 ? subtotal * (pInt / 100) : 0;
    setRes({ subtotal, interesMonto, total: subtotal + interesMonto });
  };

  return (
    <Card title="Cuantificación de daños" subtitle="Suma de rubros reclamados, con intereses opcionales sobre el subtotal.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Daño emergente"><input value={emergente} onChange={(e) => setEmergente(e.target.value)} placeholder="0" className={inputClass} /></Field>
        <Field label="Lucro cesante"><input value={lucro} onChange={(e) => setLucro(e.target.value)} placeholder="0" className={inputClass} /></Field>
        <Field label="Daño moral"><input value={moral} onChange={(e) => setMoral(e.target.value)} placeholder="0" className={inputClass} /></Field>
        <Field label="Otros rubros (gastos, etc.)"><input value={otros} onChange={(e) => setOtros(e.target.value)} placeholder="0" className={inputClass} /></Field>
        <Field label="Interés sobre subtotal (%) — opcional"><input value={interes} onChange={(e) => setInteres(e.target.value)} placeholder="Ej: 15" className={inputClass} /></Field>
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular total</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultBox label="Subtotal rubros" value={currency(res.subtotal)} />
          <ResultBox label="Intereses" value={currency(res.interesMonto)} />
          <ResultBox label="TOTAL reclamado" value={currency(res.total)} highlight />
        </div>
      )}
    </Card>
  );
}

// ── ⏳ Caducidad de instancia ───────────────────────────────────
function CaducidadInstanciaCalc() {
  const [fecha, setFecha] = useState('');
  const [instancia, setInstancia] = useState<'primera' | 'segunda' | 'incidente'>('primera');
  const [res, setRes] = useState<null | { fecha: Date; meses: number }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    const d = parseISODate(fecha);
    if (!d) return setError('Ingresá la fecha del último acto de impulso.');
    const meses = instancia === 'primera' ? 6 : instancia === 'segunda' ? 3 : 1;
    const venc = new Date(d);
    venc.setMonth(venc.getMonth() + meses);
    setRes({ fecha: venc, meses });
  };

  return (
    <Card title="Caducidad de instancia" subtitle="Plazos del art. 310 CPCCN, contados desde el último acto de impulso.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha del último acto de impulso">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RadioPill active={instancia === 'primera'} onClick={() => setInstancia('primera')} label="1ª instancia (6 meses)" />
        <RadioPill active={instancia === 'segunda'} onClick={() => setInstancia('segunda')} label="2ª/3ª instancia (3 meses)" />
        <RadioPill active={instancia === 'incidente'} onClick={() => setInstancia('incidente')} label="Incidentes (1 mes)" />
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular fecha de caducidad</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5">
          <ResultBox
            label="La caducidad operaría el"
            value={formatDateLarga(res.fecha)}
            subtitle={`${res.meses} mes${res.meses !== 1 ? 'es' : ''} de inactividad. Plazo corrido; se descuenta la feria judicial. Verificá suspensiones e interrupciones.`}
            highlight
          />
        </div>
      )}
    </Card>
  );
}

function DanosPunitivosCalc() {
	const [comp, setComp] = useState('')
	const [prob, setProb] = useState('')
	const [res, setRes] = useState<null | { punitivo: number; total: number; compensatoria: number }>(null)

	const calcular = () => {
		const C = parseMonto(comp)
		const p = parseFloat(prob.replace(',', '.')) / 100
		if (!C || !p || p <= 0 || p > 1) { setRes(null); return }
		const punitivo = C * (1 - p) / p
		setRes({ punitivo, total: C + punitivo, compensatoria: C })
	}

	return (
		<Card title="Daños punitivos (Fórmula Irigoyen Testa)" subtitle="Art. 52 bis, Ley 24.240. Multa civil: D = C × (1 − Pc) / Pc.">
			<Field label="Indemnización compensatoria (C)">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 1.000.000" value={comp} onChange={(e) => setComp(e.target.value)} />
			</Field>
			<Field label="Probabilidad de condena Pc (%)">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 80" value={prob} onChange={(e) => setProb(e.target.value)} />
			</Field>
			<MotionButton className={btnClass} onClick={calcular}>Calcular daño punitivo</MotionButton>
			{res && (
				<div className="mt-4 space-y-2">
					<ResultBox label="Daño punitivo estimado" value={currency(res.punitivo)} highlight />
					<ResultBox label="Indemnización compensatoria" value={currency(res.compensatoria)} />
					<ResultBox label="Total (compensatoria + punitivo)" value={currency(res.total)} subtitle="Orientativo. Pc = probabilidad de que el proveedor sea condenado a la indemnización compensatoria; a menor Pc, mayor multa (efecto disuasivo)." />
				</div>
			)}
		</Card>
	)
}

function IncapacidadCalc() {
	const [metodo, setMetodo] = useState<'vuoto' | 'mendez'>('mendez')
	const [ingreso, setIngreso] = useState('')
	const [edad, setEdad] = useState('')
	const [incap, setIncap] = useState('')
	const [res, setRes] = useState<null | { capital: number; a: number; n: number; i: number }>(null)

	const calcular = () => {
		const ing = parseMonto(ingreso)
		const ed = parseInt(edad, 10)
		const inc = parseFloat(incap.replace(',', '.')) / 100
		if (!ing || !ed || !inc || inc <= 0) { setRes(null); return }
		const i = metodo === 'mendez' ? 0.04 : 0.06
		const tope = metodo === 'mendez' ? 75 : 65
		const n = tope - ed
		if (n <= 0) { setRes(null); return }
		let a = ing * 13 * inc
		if (metodo === 'mendez') a = a * (60 / ed)
		const Vn = 1 / Math.pow(1 + i, n)
		const capital = a * (1 - Vn) / i
		setRes({ capital, a, n, i })
	}

	return (
		<Card title="Indemnización por incapacidad" subtitle="Fórmulas Vuoto (i 6%, tope 65) y Méndez (i 4%, tope 75). C = a × (1 − Vⁿ)/i.">
			<Field label="Método">
				<div className="flex flex-wrap gap-2">
					<RadioPill active={metodo === 'mendez'} onClick={() => setMetodo('mendez')} label="Méndez (2008)" />
					<RadioPill active={metodo === 'vuoto'} onClick={() => setMetodo('vuoto')} label="Vuoto (1978)" />
				</div>
			</Field>
			<Field label="Ingreso mensual">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 800.000" value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
			</Field>
			<Field label="Edad al momento del hecho">
				<input className={inputClass} inputMode="numeric" placeholder="Ej: 35" value={edad} onChange={(e) => setEdad(e.target.value)} />
			</Field>
			<Field label="% de incapacidad">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 30" value={incap} onChange={(e) => setIncap(e.target.value)} />
			</Field>
			<MotionButton className={btnClass} onClick={calcular}>Calcular indemnización</MotionButton>
			{res && (
				<div className="mt-4 space-y-2">
					<ResultBox label="Capital indemnizatorio" value={currency(res.capital)} highlight />
					<ResultBox label="Renta anual base (a)" value={currency(res.a)} />
					<ResultBox label="Años computados (n)" value={`${res.n} años · tasa ${(res.i * 100).toFixed(0)}%`} subtitle="Orientativo. La CSJN (‘Aróstegui’, 2008) exige valoración integral: la fórmula es un piso de referencia, el daño moral se fija aparte." />
				</div>
			)}
		</Card>
	)
}

function AmpliacionDistanciaCalc() {
	const [base, setBase] = useState('')
	const [km, setKm] = useState('')
	const [res, setRes] = useState<null | { adicionales: number; total: number }>(null)

	const calcular = () => {
		const b = parseInt(base, 10)
		const d = parseFloat(km.replace(/\./g, '').replace(',', '.'))
		if (isNaN(b) || isNaN(d) || d < 0) { setRes(null); return }
		const full = Math.floor(d / 200)
		const resto = d - full * 200
		const extra = resto >= 100 ? 1 : 0
		const adicionales = full + extra
		setRes({ adicionales, total: b + adicionales })
	}

	return (
		<Card title="Ampliación de plazo por distancia" subtitle="Art. 158 CPCCN: 1 día cada 200 km (o fracción ≥ 100 km). Tabla: Acordada CSJN 5/2010.">
			<Field label="Plazo base (días)">
				<input className={inputClass} inputMode="numeric" placeholder="Ej: 5" value={base} onChange={(e) => setBase(e.target.value)} />
			</Field>
			<Field label="Distancia (km)">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 650" value={km} onChange={(e) => setKm(e.target.value)} />
			</Field>
			<MotionButton className={btnClass} onClick={calcular}>Calcular ampliación</MotionButton>
			{res && (
				<div className="mt-4 space-y-2">
					<ResultBox label="Días adicionales por distancia" value={`${res.adicionales} días`} />
					<ResultBox label="Plazo total ampliado" value={`${res.total} días`} highlight subtitle="Orientativo. Ojo: varias jurisdicciones con gestión electrónica (ej. Corrientes) ya no aplican la ampliación por distancia." />
				</div>
			)}
		</Card>
	)
}

function ProrrateoCalc() {
	const [monto, setMonto] = useState('')
	const [honorarios, setHonorarios] = useState('')
	const [res, setRes] = useState<null | { tope: number; suma: number; excede: boolean; factor: number; aCargoCondenado: number; excedente: number }>(null)

	const calcular = () => {
		const m = parseMonto(monto)
		const h = parseMonto(honorarios)
		if (!m || !h) { setRes(null); return }
		const tope = m * 0.25
		const excede = h > tope
		const factor = excede ? tope / h : 1
		const aCargoCondenado = excede ? tope : h
		const excedente = excede ? h - tope : 0
		setRes({ tope, suma: h, excede, factor, aCargoCondenado, excedente })
	}

	return (
		<Card title="Prorrateo de honorarios (tope 25%)" subtitle="Art. 730 CCyCN: las costas a cargo del condenado no superan el 25% del monto de la sentencia.">
			<Field label="Monto de la sentencia">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 10.000.000" value={monto} onChange={(e) => setMonto(e.target.value)} />
			</Field>
			<Field label="Suma total de honorarios regulados">
				<input className={inputClass} inputMode="decimal" placeholder="Ej: 3.500.000" value={honorarios} onChange={(e) => setHonorarios(e.target.value)} />
			</Field>
			<MotionButton className={btnClass} onClick={calcular}>Calcular prorrateo</MotionButton>
			{res && (
				<div className="mt-4 space-y-2">
					<ResultBox label="Tope legal (25%)" value={currency(res.tope)} highlight />
					{res.excede ? (
						<>
							<ResultBox label="Factor de prorrateo" value={`${(res.factor * 100).toFixed(2)}%`} />
							<ResultBox label="A cargo del condenado" value={currency(res.aCargoCondenado)} />
							<ResultBox label="Excedente (a cargo de quien contrató)" value={currency(res.excedente)} subtitle="Los honorarios superan el 25%: el condenado paga hasta el tope y el resto lo afronta la parte que contrató al profesional." />
						</>
					) : (
						<ResultBox label="A cargo del condenado" value={currency(res.aCargoCondenado)} subtitle="Los honorarios no superan el 25%: se pagan completos, sin prorrateo." />
					)}
				</div>
			)}
		</Card>
	)
}

// ============ CALCULADORA DE MEDIACIÓN (3 jurisdicciones) ============
const fmtARS = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 })

// ---------- NACIÓN (UHOM · Ley 26.589) ----------
type TipoNacion = "patrimonial" | "familia" | "indeterminable" | "sin_valor"
function calcMediacionNacion(o: { tipo: TipoNacion; monto: number; audiencias: number; valorUHOM: number }) {
  const { tipo, monto, audiencias, valorUHOM } = o
  let item = "", basicoUHOM = 0
  if (tipo === "familia") { item = "Familia (art. 31 b/c)"; basicoUHOM = 9 }
  else if (tipo === "indeterminable") { item = "H (indeterminable)"; basicoUHOM = 20 }
  else if (tipo === "sin_valor") { item = "I (sin valor pecuniario)"; basicoUHOM = 12 }
  else {
    const u = monto / valorUHOM
    if (u <= 30) { item = "A"; basicoUHOM = 3 }
    else if (u <= 60) { item = "B"; basicoUHOM = 6 }
    else if (u <= 150) { item = "C"; basicoUHOM = 9 }
    else if (u <= 300) { item = "D"; basicoUHOM = 12 }
    else if (u <= 600) { item = "E"; basicoUHOM = 16 }
    else if (u <= 1000) { item = "F"; basicoUHOM = 20 }
    else { item = "G (2% con tope 120 UHOM)"; basicoUHOM = Math.min(0.02 * monto, 120 * valorUHOM) / valorUHOM }
  }
  const basicoPesos = basicoUHOM * valorUHOM
  const adicUHOM = tipo === "familia"
    ? Math.max(0, audiencias - 1) * 1
    : Math.max(0, audiencias - 3) * (item === "A" || item === "B" ? 0.5 : 1)
  const adicPesos = adicUHOM * valorUHOM
  return { item, basicoUHOM, basicoPesos, adicUHOM, adicPesos,
    provisionalPesos: 2 * valorUHOM, totalPesos: basicoPesos + adicPesos }
}

// ---------- BUENOS AIRES (Jus Ley 14.967 · Dec. 600/21 art. 31) ----------
function calcMediacionBA(o: { monto: number; indeterminado: boolean; valorJus: number }) {
  const { monto, indeterminado, valorJus } = o
  let tramo = "", honJus = 0
  if (indeterminado) { tramo = "Monto indeterminado"; honJus = 8.69 }
  else {
    const j = monto / valorJus
    if (j <= 32.07) { tramo = "a"; honJus = 2.18 }
    else if (j <= 79.80) { tramo = "b"; honJus = 7.31 }
    else if (j <= 159.60) { tramo = "c"; honJus = 13.04 }
    else if (j <= 319.20) { tramo = "d"; honJus = 20.87 }
    else if (j <= 638.41) { tramo = "e"; honJus = 31.31 }
    else if (j <= 1112.32) { tramo = "f"; honJus = 47.70 }
    else { tramo = "g"; honJus = 47.70 + Math.ceil((j - 1112.32) / 79.80) * 4.37 }
  }
  return { tramo, honJus, honPesos: honJus * valorJus, anticipoJus: 1, anticipoPesos: valorJus }
}

// ---------- CORRIENTES (Acuerdo 14/22 art. 18 RIM · Ley 5931) ----------
type ResultadoCtes = "acuerdo" | "sin_acuerdo"
type TipoCtes = "patrimonial" | "alimentaria" | "sin_valor"
function calcMediacionCorrientes(o: {
  resultado: ResultadoCtes; tipo: TipoCtes; monto: number; cuotaMensual: number; valorJus: number
}) {
  const { resultado, tipo, monto, cuotaMensual, valorJus } = o
  const pct = resultado === "acuerdo" ? 0.05 : 0.025
  let honPesos = 0, detalle = "", aplicaMinimo = false
  if (tipo === "sin_valor") {
    const jus = resultado === "acuerdo" ? 4 : 2
    honPesos = jus * valorJus
    detalle = `${jus} Jus (sin contenido patrimonial / monto indeterminado)`
  } else {
    const base = tipo === "alimentaria" ? cuotaMensual * 12 : monto
    honPesos = base * pct
    detalle = `${pct * 100}% sobre ${tipo === "alimentaria" ? "la cuota × 12" : "el monto"}`
    if (resultado === "acuerdo" && honPesos < valorJus) { honPesos = valorJus; aplicaMinimo = true }
  }
  return { honPesos, honJus: honPesos / valorJus, detalle, aplicaMinimo }
}

function MediacionTab() {
  const [juris, setJuris] = useState<"nacion" | "baires" | "corrientes">("nacion")

  // Nación
  const [uhom, setUhom] = useState(String(UHOM_VALOR))
  const [tipoNac, setTipoNac] = useState<TipoNacion>("patrimonial")
  const [montoNac, setMontoNac] = useState("")
  const [audNac, setAudNac] = useState("1")

  // Buenos Aires
  const [jusBA, setJusBA] = useState(String(JUS_BA_MEDIACION))
  const [indetBA, setIndetBA] = useState(false)
  const [montoBA, setMontoBA] = useState("")

  // Corrientes
  const [jusC, setJusC] = useState(String(JUS_CORRIENTES))
  const [resC, setResC] = useState<ResultadoCtes>("acuerdo")
  const [tipoC, setTipoC] = useState<TipoCtes>("patrimonial")
  const [montoC, setMontoC] = useState("")
  const [cuotaC, setCuotaC] = useState("")

  const rNac = calcMediacionNacion({
    tipo: tipoNac, monto: parseMonto(montoNac), audiencias: Number(audNac) || 1, valorUHOM: Number(uhom) || UHOM_VALOR,
  })
  const rBA = calcMediacionBA({
    monto: parseMonto(montoBA), indeterminado: indetBA, valorJus: Number(jusBA) || JUS_BA_MEDIACION,
  })
  const rC = calcMediacionCorrientes({
    resultado: resC, tipo: tipoC, monto: parseMonto(montoC), cuotaMensual: parseMonto(cuotaC), valorJus: Number(jusC) || JUS_CORRIENTES,
  })

  return (
    <Card title="Honorarios de mediación">
      <div className="block mb-4">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Jurisdicción</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <RadioPill active={juris === 'nacion'} onClick={() => setJuris('nacion')} label="Nación" />
          <RadioPill active={juris === 'baires'} onClick={() => setJuris('baires')} label="Buenos Aires" />
          <RadioPill active={juris === 'corrientes'} onClick={() => setJuris('corrientes')} label="Corrientes" />
        </div>
      </div>

      {/* ---------- NACIÓN ---------- */}
      {juris === "nacion" && (
        <div className="space-y-4">
          <Field label="Valor UHOM ($)">
            <input className={inputClass} value={uhom} onChange={(e) => setUhom(e.target.value)} type="number" />
          </Field>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo de asunto</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={tipoNac === 'patrimonial'} onClick={() => setTipoNac('patrimonial')} label="Patrimonial" />
              <RadioPill active={tipoNac === 'familia'} onClick={() => setTipoNac('familia')} label="Familia" />
              <RadioPill active={tipoNac === 'indeterminable'} onClick={() => setTipoNac('indeterminable')} label="Indeterminable" />
              <RadioPill active={tipoNac === 'sin_valor'} onClick={() => setTipoNac('sin_valor')} label="Sin valor" />
            </div>
          </div>

          {tipoNac === "patrimonial" && (
            <Field label="Monto del asunto ($)">
              <input className={inputClass} value={montoNac} onChange={(e) => setMontoNac(e.target.value)} />
            </Field>
          )}

          <Field label="Cantidad de audiencias">
            <input className={inputClass} value={audNac} onChange={(e) => setAudNac(e.target.value)} type="number" />
          </Field>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultBox label="Ítem de escala" value={rNac.item} />
            <ResultBox label="Honorario básico" value={`${rNac.basicoUHOM.toFixed(2)} UHOM`} subtitle={fmtARS(rNac.basicoPesos)} />
            <ResultBox label="Adicional por audiencias" value={`${rNac.adicUHOM.toFixed(2)} UHOM`} subtitle={fmtARS(rNac.adicPesos)} />
            <ResultBox label="Honorario provisional (2 UHOM)" value={fmtARS(rNac.provisionalPesos)} />
          </div>
          <ResultBox label="TOTAL estimado" value={fmtARS(rNac.totalPesos)} highlight={true} />
        </div>
      )}

      {/* ---------- BUENOS AIRES ---------- */}
      {juris === "baires" && (
        <div className="space-y-4">
          <Field label="Valor Jus Ley 14.967 ($)">
            <input className={inputClass} value={jusBA} onChange={(e) => setJusBA(e.target.value)} type="number" />
          </Field>
          <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer">
            <input type="checkbox" checked={indetBA} onChange={(e) => setIndetBA(e.target.checked)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            Monto indeterminado
          </label>
          {!indetBA && (
            <Field label="Monto del asunto ($)">
              <input className={inputClass} value={montoBA} onChange={(e) => setMontoBA(e.target.value)} />
            </Field>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultBox label="Tramo (art. 31 Dec. 600/21)" value={rBA.tramo} />
            <ResultBox label="Anticipo (1 Jus)" value={fmtARS(rBA.anticipoPesos)} />
          </div>
          <div className="mt-3">
            <ResultBox label="Honorario" value={`${rBA.honJus.toFixed(2)} Jus`} subtitle={fmtARS(rBA.honPesos)} highlight={true} />
          </div>

          <p className="text-xs text-slate-500 mt-2">⚠️ En Buenos Aires las causas de familia (divorcio, alimentos, etc.) están excluidas de la mediación previa obligatoria.</p>
        </div>
      )}

      {/* ---------- CORRIENTES ---------- */}
      {juris === "corrientes" && (
        <div className="space-y-4">
          <Field label="Valor Jus Corrientes ($)">
            <input className={inputClass} value={jusC} onChange={(e) => setJusC(e.target.value)} type="number" />
          </Field>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Resultado de la mediación</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={resC === 'acuerdo'} onClick={() => setResC('acuerdo')} label="Con acuerdo" />
              <RadioPill active={resC === 'sin_acuerdo'} onClick={() => setResC('sin_acuerdo')} label="Sin acuerdo" />
            </div>
          </div>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo de asunto</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={tipoC === 'patrimonial'} onClick={() => setTipoC('patrimonial')} label="Patrimonial" />
              <RadioPill active={tipoC === 'alimentaria'} onClick={() => setTipoC('alimentaria')} label="Cuota alimentaria" />
              <RadioPill active={tipoC === 'sin_valor'} onClick={() => setTipoC('sin_valor')} label="Sin contenido patrimonial" />
            </div>
          </div>

          {tipoC === "patrimonial" && (
            <Field label="Monto ($)">
              <input className={inputClass} value={montoC} onChange={(e) => setMontoC(e.target.value)} />
            </Field>
          )}
          {tipoC === "alimentaria" && (
            <Field label="Cuota mensual ($)">
              <input className={inputClass} value={cuotaC} onChange={(e) => setCuotaC(e.target.value)} />
            </Field>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultBox label="Cálculo" value={rC.detalle} />
            <ResultBox label="Honorario" value={`${rC.honJus.toFixed(2)} Jus`} subtitle={fmtARS(rC.honPesos)} highlight={true} />
            {rC.aplicaMinimo && <ResultBox label="Nota" value="Se aplicó el honorario mínimo de 1 Jus" />}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-5">
        Honorarios mínimos indicativos. Nación: Ley 26.589 (CABA/Justicia Nacional). Buenos Aires: Ley 13.951 + Dec. 600/21.
        Corrientes: Ley 5931 + Acuerdo 14/22 del STJ (art. 18 RIM). Actualizá el valor de la unidad vigente del mes.
      </p>
    </Card>
  )
}

export function CalculadorasClient({ puedeGuardar = true }: { puedeGuardar?: boolean }) {
  const [tab, setTab] = useState<Tab>('plazos');
  const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
    { id: 'plazos', label: 'Plazos procesales', icon: CalendarClock },
    { id: 'honorarios', label: 'Honorarios', icon: Coins },
    { id: 'tasa', label: 'Tasa e intereses', icon: Scale },
    { id: 'laboral', label: 'Liquidación laboral', icon: Briefcase },
    { id: 'intereses', label: 'Intereses judiciales', icon: TrendingUp },
    { id: 'alimentos', label: 'Cuota alimentaria', icon: Users },
    { id: 'danos', label: 'Daños', icon: Gavel },
    { id: 'caducidad', label: 'Caducidad', icon: Hourglass },
    { id: 'punitivos', label: 'Daños punitivos', icon: Siren },
    { id: 'incapacidad', label: 'Incapacidad', icon: HeartPulse },
    { id: 'distancia', label: 'Ampliación distancia', icon: MapPin },
    { id: 'prorrateo', label: 'Prorrateo 25%', icon: Percent },
    { id: 'mediacion', label: 'Mediación', icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Herramientas jurídicas</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Calculadoras</h1>
        <p className="mt-1 text-sm text-slate-400">Cálculos orientativos para Justicia Nacional / Federal.</p>
      </div>

      <MotionCard index={0} className="flex items-start gap-3 border-amber-500/20 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200">
          Resultados <strong>estimativos y no vinculantes</strong>. Verificá siempre plazos, feriados, valor de la UMA y
          aranceles con las fuentes oficiales antes de presentar.
        </p>
      </MotionCard>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'plazos' && <PlazosCalc puedeGuardar={puedeGuardar} />}
      {tab === 'honorarios' && <HonorariosCalc />}
      {tab === 'tasa' && <TasaCalc />}
      {tab === 'laboral' && <LiquidacionLaboralCalc />}
      {tab === 'intereses' && <InteresesJudicialesCalc />}
      {tab === 'alimentos' && <CuotaAlimentariaCalc />}
      {tab === 'danos' && <DanosCalc />}
      {tab === 'caducidad' && <CaducidadInstanciaCalc />}
      {tab === 'punitivos' && <DanosPunitivosCalc />}
      {tab === 'incapacidad' && <IncapacidadCalc />}
      {tab === 'distancia' && <AmpliacionDistanciaCalc />}
      {tab === 'prorrateo' && <ProrrateoCalc />}
      {tab === 'mediacion' && <MediacionTab />}
    </div>
  );
}
