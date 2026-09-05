'use client';

import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  Coins,
  Scale,
  AlertTriangle,
  CalendarPlus,
  Loader2,
  Briefcase,
  TrendingUp,
  Users,
  Gavel,
  Hourglass,
  Siren,
  HeartPulse,
  MapPin,
  Percent,
} from 'lucide-react';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { guardarPlazoEnAgenda } from './actions';
import {
  UMA_VALOR,
  UMA_VIGENCIA,
  TASA_JUSTICIA_PORCENTAJE,
  UHOM_VALOR,
  JUS_BA_MEDIACION,
  JUS_CORRIENTES,
  LegalJurisdiction,
  LEGAL_CALENDARS,
  JURISDICTION_LABELS,
  LEGAL_PARAMETERS,
} from '@/lib/legal/config';
import { parseISODate, sumarDiasCorridos, calcularVencimientoProcesal } from '@/lib/legal/plazos';
import { type NationalJusticeFeeCaseType } from '@/lib/legal/tasaJusticia';
import {
  calcularCaducidadBase,
  type CaducidadTipo,
  type CaducidadResultado,
  calcularEscalaArt21,
  calcularDanosPunitivos,
  calcularIncapacidad,
  calcularProrrateo,
  calcMediacionNacion,
  calcMediacionBA,
  calcMediacionCorrientes,
  type TipoMediacionNacion,
  type ResultadoMediacionCtes,
  type TipoMediacionCtes,
} from '@/lib/legal/calculadoras';
import {
  calcularLiquidacionLaboral,
  type RegimenLaboral,
  type LiquidacionLaboralResultado,
} from '@/lib/legal/liquidacion';

type Tab =
  | 'plazos'
  | 'honorarios'
  | 'tasa'
  | 'laboral'
  | 'intereses'
  | 'alimentos'
  | 'danos'
  | 'caducidad'
  | 'punitivos'
  | 'incapacidad'
  | 'distancia'
  | 'prorrateo'
  | 'mediacion';

const currency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

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

// ── 📅 Plazos procesales ────────────────────────────────────────
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
  const [kmDistancia, setKmDistancia] = useState('');

  const calcular = () => {
    setError(null);
    setResultado(null);
    setGuardado(null);

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
        calAnio: venc.getFullYear(),
      });
      return;
    }

    if (!jurisdiccion) return setError('Seleccioná una jurisdicción.');
    const cal = LEGAL_CALENDARS[jurisdiccion as LegalJurisdiction];
    if (cal.coverage !== 'verified') return setError('Calendario todavía no configurado para esta jurisdicción/año.');

    const km = parseInt(kmDistancia, 10);
    const res = calcularVencimientoProcesal({
      fechaNotificacion: fecha,
      diasHabiles: n,
      jurisdiccion: jurisdiccion as LegalJurisdiction,
      kmDistancia: Number.isFinite(km) ? km : 0,
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
      texto: res.diasAmpliacion > 0 ? `${n} + ${res.diasAmpliacion} días por dist. (${res.diasTotales} totales)` : `${n} día${n > 1 ? 's' : ''} hábiles judiciales`,
      adv: res.advertencia,
      fuente: res.fuente,
      calAnio: res.calendarioAnio,
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
        ? res.existing
          ? 'ℹ️ Ya en agenda'
          : '✅ Cargado a la agenda'
        : res.motivo === 'no_auth'
          ? 'Iniciá sesión para guardar.'
          : 'No se pudo guardar, intentá de nuevo.'
    );
    if (res.ok && !res.existing) setReferencia('');
  };

  return (
    <Card title="Plazos procesales" subtitle="Calculá la fecha de vencimiento desde una fecha de inicio.">
      <div className="mb-4">
        <Field label="Jurisdicción (obligatorio)">
          <select
            value={jurisdiccion}
            onChange={(e) => { setJurisdiccion(e.target.value as LegalJurisdiction | ''); setGuardado(null); setResultado(null); }}
            className={inputClass}
          >
            <option value="" className="bg-white text-slate-900">-- Seleccionar jurisdicción --</option>
            {Object.entries(JURISDICTION_LABELS).map(([k, v]) => (
              <option key={k} value={k} className="bg-white text-slate-900">{v}</option>
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
          <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setGuardado(null); setResultado(null); }} className={inputClass} />
        </Field>
        <Field label="Cantidad de días">
          <input type="number" min={1} value={dias} onChange={(e) => { setDias(e.target.value); setGuardado(null); setResultado(null); }} placeholder="Ej: 5" className={inputClass} />
        </Field>
      </div>

      {tipo === 'habiles' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Ampliación por distancia (km) — art. 158 CPCCN">
            <input type="number" min={0} value={kmDistancia} onChange={(e) => { setKmDistancia(e.target.value); setGuardado(null); setResultado(null); }} placeholder="Ej: 450" className={inputClass} />
          </Field>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <RadioPill active={tipo === 'habiles'} onClick={() => { setTipo('habiles'); setResultado(null); setError(null); setGuardado(null); }} label="Días hábiles" />
        <RadioPill active={tipo === 'corridos'} onClick={() => { setTipo('corridos'); setResultado(null); setError(null); setGuardado(null); }} label="Días corridos" />
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
                onChange={(e) => { setReferencia(e.target.value); setGuardado(null); }}
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

// ── 💰 Honorarios Ley 27.423 ───────────────────────────────────
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

      <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-md">
        <p className="text-xs text-cyan-400 font-medium">
          Parámetro oficial UMA verificado (Res. SGA 1352/2026 CSJN). La fórmula de escala del art. 21 Ley 27.423 es orientativa y requiere verificación profesional en cada caso.
        </p>
        <p className="text-xs text-slate-300 mt-2">
          UMA oficial: {currency(UMA_VALOR)} (vigente desde el {UMA_VIGENCIA}). Fuente oficial: {LEGAL_PARAMETERS.uma.sourceName}. La escala del art. 21 Ley 27.423 es continua y acumulativa por tramos respetando el máximo del grado anterior (no se descartan fracciones de UMA). 2ª instancia = 30–35% de lo de 1ª si se confirma; 30–40% si se revoca. Apoderado sin patrocinio = 140%; procurador = 40% (art. 20).
        </p>
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular honorarios</MotionButton>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {res && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ResultBox label="Base en UMA" value={`${res.montoUMA.toFixed(2)} UMA`} subtitle={`Tramo art. 21: ${res.tramoMin}% – ${res.tramoMax}%`} />
          <ResultBox label="Equivalente en UMA (honorario)" value={`${(res.hMin / UMA_VALOR).toFixed(2)} – ${(res.hMax / UMA_VALOR).toFixed(2)} UMA`} />
          <div className="sm:col-span-2">
            <ResultBox label="Honorarios estimados" value={`${currency(res.hMin)} — ${currency(res.hMax)}`} subtitle="Rango mínimo–máximo de la escala legal acumulativa" highlight />
          </div>
        </div>
      )}
    </Card>
  );
}

// ── ⚖️ Tasa de justicia e intereses ─────────────────────────────
function TasaCalc() {
  const [jurisdiccion, setJurisdiccion] = useState<LegalJurisdiction | ''>('');
  const [tipoProceso, setTipoProceso] = useState<NationalJusticeFeeCaseType | ''>('');
  const [confirmacion, setConfirmacion] = useState(false);
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
    if (!jurisdiccion) return setError('Seleccioná una jurisdicción.');
    if (jurisdiccion === 'pba' || jurisdiccion === 'corrientes') return;
    if (!tipoProceso) return setError('Seleccioná un tipo de proceso.');
    if (tipoProceso !== 'general_pecuniary') return;
    if (!confirmacion) return setError('Confirmá que es una pretensión pecuniaria general.');

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
      <Card title="Tasa de justicia" subtitle="Porcentaje sobre el monto del proceso (Ley 23.898 — Justicia Nacional/Federal).">
        <div className="mb-4">
          <Field label="Jurisdicción (obligatorio)">
            <select
              value={jurisdiccion}
              data-testid="tasa-jurisdiccion"
              onChange={(e) => {
                const j = e.target.value as LegalJurisdiction | '';
                setJurisdiccion(j);
                setTipoProceso('');
                setTasaRes(null);
                setError(null);
                setConfirmacion(false);
              }}
              className={inputClass}
            >
              <option value="" className="bg-white text-slate-900">-- Seleccionar jurisdicción --</option>
              <option value="nacion" className="bg-white text-slate-900">Justicia Nacional / Federal</option>
              <option value="pba" className="bg-white text-slate-900">Provincia de Buenos Aires</option>
              <option value="corrientes" className="bg-white text-slate-900">Provincia de Corrientes</option>
            </select>
          </Field>
        </div>

        {jurisdiccion === 'pba' && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
            ⚠️ Cobertura no implementada para Provincia de Buenos Aires (Código Fiscal PBA / Ley Impositiva).
          </div>
        )}
        {jurisdiccion === 'corrientes' && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
            ⚠️ Cobertura no implementada para Provincia de Corrientes (Código Fiscal / Ley Tarifaria).
          </div>
        )}

        {jurisdiccion === 'nacion' && (
          <>
            <Field label="Tipo de proceso (Ley 23.898)">
              <select
                value={tipoProceso}
                data-testid="tasa-tipo-proceso"
                onChange={(e) => {
                  setTipoProceso(e.target.value as NationalJusticeFeeCaseType);
                  setTasaRes(null);
                  setError(null);
                  setConfirmacion(false);
                }}
                className={inputClass}
              >
                <option value="" className="bg-white text-slate-900">-- Seleccionar tipo de proceso --</option>
                <option value="general_pecuniary" className="bg-white text-slate-900">Pretensión pecuniaria general (3%)</option>
                <option value="succession" className="bg-white text-slate-900">Sucesorio</option>
                <option value="employment" className="bg-white text-slate-900">Laboral</option>
                <option value="family" className="bg-white text-slate-900">Familia</option>
                <option value="indeterminate" className="bg-white text-slate-900">Monto indeterminado</option>
                <option value="insolvency" className="bg-white text-slate-900">Concurso / Quiebra</option>
                <option value="third_party_claim" className="bg-white text-slate-900">Tercería</option>
                <option value="survey_boundary" className="bg-white text-slate-900">Mensura / Deslinde</option>
                <option value="amparo" className="bg-white text-slate-900">Acción de amparo</option>
                <option value="legal_aid" className="bg-white text-slate-900">Beneficio de litigar sin gastos</option>
                <option value="other" className="bg-white text-slate-900">Otro</option>
              </select>
            </Field>
            {tipoProceso === 'general_pecuniary' && (
              <>
                <Field label="Monto del proceso ($)">
                  <input type="text" inputMode="decimal" value={montoTasa} onChange={(e) => setMontoTasa(e.target.value)} placeholder="Ej: 1.000.000" className={inputClass} data-testid="tasa-monto" />
                </Field>
                <label className="mt-2 flex items-start gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={confirmacion} onChange={(e) => { setConfirmacion(e.target.checked); setTasaRes(null); setError(null); }} className="mt-1" />
                  Confirmo que se trata de una pretensión pecuniaria general y que no identifico un régimen especial o exención.
                </label>
              </>
            )}
            {tipoProceso && tipoProceso !== 'general_pecuniary' && (
              <div className="mt-2 text-xs text-amber-400">
                La Ley 23.898 contempla reglas especiales, tasa reducida o exenciones para esta materia. Requiere revisión profesional.
              </div>
            )}
          </>
        )}

        {jurisdiccion === 'nacion' && tipoProceso === 'general_pecuniary' && (
          <MotionButton type="button" onClick={calcularTasa} className={btnClass} data-testid="tasa-submit">Calcular tasa</MotionButton>
        )}

        {tasaRes !== null && jurisdiccion === 'nacion' && (
          <div className="mt-4" data-testid="tasa-resultado">
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
  const [regimen, setRegimen] = useState<RegimenLaboral>('lct_general');
  const [periodoPruebaConcluido, setPeriodoPruebaConcluido] = useState(true);
  const [huboPreaviso, setHuboPreaviso] = useState(false);
  const [correspondeIntegracion, setCorrespondeIntegracion] = useState(true);
  const [confirmado, setConfirmado] = useState(false);
  const [res, setRes] = useState<LiquidacionLaboralResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    if (!confirmado) {
      return setError('Debés confirmar que revisaste las exclusiones y el régimen aplicable (LCT modif. por Ley 27.802 y Dec. 407/2026).');
    }
    const base = parseMonto(remun);
    if (!Number.isFinite(base) || base <= 0) return setError('Ingresá la mejor remuneración mensual, normal y habitual.');
    if (!ingreso || !egreso) return setError('Ingresá fechas de ingreso y egreso válidas.');

    try {
      const calculo = calcularLiquidacionLaboral({
        remuneracion: base,
        fechaIngreso: ingreso,
        fechaEgreso: egreso,
        regimen,
        periodoPruebaConcluido,
        huboPreaviso,
        correspondeIntegracion,
      });
      setRes(calculo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en el cálculo de la liquidación.');
    }
  };

  return (
    <Card
      title="Liquidación por despido sin causa"
      subtitle="Estimación orientativa de rubros indemnizatorios básicos (LCT 20.744 modif. por Ley 27.802 y Dec. 407/2026)."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Mejor remuneración mensual (normal y habitual)">
          <input value={remun} onChange={(e) => setRemun(e.target.value)} placeholder="Ej: 800.000" className={inputClass} />
        </Field>
        <Field label="Fecha de ingreso">
          <input type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fecha de egreso">
          <input type="date" value={egreso} onChange={(e) => setEgreso(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Régimen legal aplicable">
          <div className="flex flex-wrap gap-2">
            <RadioPill active={regimen === 'lct_general'} onClick={() => setRegimen('lct_general')} label="Régimen general LCT (art. 245)" />
            <RadioPill active={regimen === 'fondo_cese'} onClick={() => setRegimen('fondo_cese')} label="Fondo / Sistema de cese laboral (CCT)" />
          </div>
        </Field>

        <div className="grid gap-2 sm:grid-cols-3 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={huboPreaviso}
              onChange={(e) => setHuboPreaviso(e.target.checked)}
              className="rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            />
            <span>Hubo preaviso otorgado</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={correspondeIntegracion}
              onChange={(e) => setCorrespondeIntegracion(e.target.checked)}
              className="rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            />
            <span>Corresponde integración de mes</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={periodoPruebaConcluido}
              onChange={(e) => setPeriodoPruebaConcluido(e.target.checked)}
              className="rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            />
            <span>Período de prueba concluido</span>
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200/90 leading-relaxed space-y-2">
        <p className="font-semibold text-amber-300">
          ⚠️ Exclusiones y advertencias normativas obligatorias:
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Tope indemnizatorio (art. 245 LCT):</strong> No aplica tope de convenio colectivo ni doctrina jurisprudencial (&ldquo;Vizzoti&rdquo;).</li>
          <li><strong>Fondos de cese laboral:</strong> La Ley 27.802 y el Decreto 407/2026 permiten a los convenios colectivos sustituir la indemnización por un fondo o sistema de cese laboral; verificá el CCT de la actividad.</li>
          <li><strong>Multas e indemnizaciones especiales:</strong> No incluye multas derogadas (arts. 8 a 15 Ley 24.013, Ley 25.323, art. 80 LCT modif. Ley 27.742) ni agravamientos por maternidad o matrimonio.</li>
          <li><strong>Rubros salariales:</strong> No computa diferencias de salarios, horas extras, comisiones pendientes ni liquidación de haberes del mes de egreso.</li>
        </ul>
        <label className="mt-3 flex items-start gap-2 cursor-pointer font-medium text-slate-200 pt-1 border-t border-amber-500/20">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 rounded border-amber-400/50 bg-slate-900 text-amber-500 focus:ring-amber-400"
          />
          <span>Entiendo el alcance meramente estimativo y confirmo que verificaré el CCT, topes y régimen aplicable al caso.</span>
        </label>
      </div>

      <MotionButton onClick={calcular} className={btnClass}>Calcular liquidación</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-400">
            Antigüedad exacta: <strong>{res.anios} año{res.anios !== 1 ? 's' : ''}, {res.meses} mes{res.meses !== 1 ? 'es' : ''} y {res.dias} día{res.dias !== 1 ? 's' : ''}</strong>{' '}
            ({res.aniosComputablesArt245} período{res.aniosComputablesArt245 !== 1 ? 's' : ''} computable{res.aniosComputablesArt245 !== 1 ? 's' : ''} para el art. 245 LCT).
          </p>
          {res.advertencias.map((adv, idx) => (
            <div key={idx} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              ℹ️ {adv}
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultBox label="Indemnización por antigüedad (art. 245 LCT)" value={currency(res.indemnizacionAntiguedad)} subtitle={res.enPeriodoPrueba ? 'En período de prueba ($0)' : '1 mes por año o fracción > 3 meses'} />
            <ResultBox label="Preaviso + SAC" value={currency(res.preavisoTotal)} subtitle={res.huboPreaviso ? 'Preavisado ($0)' : (res.enPeriodoPrueba ? '15 días (período de prueba) + SAC' : (res.anios >= 5 ? '2 meses + SAC' : '1 mes + SAC'))} />
            <ResultBox label="Integración mes de despido + SAC" value={currency(res.integracionTotal)} subtitle={res.esUltimoDiaMes ? 'Egreso último día del mes ($0)' : 'Días faltantes del mes + SAC'} />
            <ResultBox label="SAC proporcional" value={currency(res.sacProporcional)} />
            <ResultBox label="Vacaciones no gozadas + SAC" value={currency(res.vacacionesNoGozadas)} subtitle={`Escala: ${res.diasVacacionesEscala} días`} />
            <ResultBox label="TOTAL estimado orientativo" value={currency(res.total)} highlight />
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
        <p className="mt-1 text-xs text-slate-400">
          Elegí el tipo de tasa según el fuero y cargá el valor anual (%) a aplicar. Referencia orientativa Banco Nación (cartera general): 27.60% TNA vencida (al 26/08/2026). No se impone automáticamente como obligatoria.
        </p>
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-300">
          ℹ️ Centinela IA no computa cálculos automáticos sobre series históricas no cargadas ni aplica tasas fijas predeterminadas. La tasa y período deben ser definidos o verificados manualmente por el profesional según el criterio judicial del fuero o la liquidación del expediente.
        </div>
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
  const [porcentaje, setPorcentaje] = useState('');
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
    if (!porcentaje || !Number.isFinite(p) || p <= 0 || p > 100) {
      return setError('Ingresá el porcentaje (%) a aplicar sobre los ingresos.');
    }
    if (!Number.isFinite(h) || h <= 0) return setError('Ingresá la cantidad de hijos/as.');
    const cuota = i * (p / 100);
    setRes({ cuota, porHijo: cuota / h });
  };

  return (
    <Card
      title="Cuota alimentaria"
      subtitle="Estimación orientativa a partir de los ingresos netos del alimentante y del porcentaje que el profesional ingrese según el caso."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ingresos netos mensuales ($)">
          <input value={ingresos} onChange={(e) => setIngresos(e.target.value)} placeholder="Ej: 900.000" className={inputClass} />
        </Field>
        <Field label="Porcentaje (%) — ingreso manual requerido">
          <input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} placeholder="Ej: 25" className={inputClass} />
        </Field>
        <Field label="Cantidad de hijos/as">
          <input value={hijos} onChange={(e) => setHijos(e.target.value)} placeholder="Ej: 1" className={inputClass} />
        </Field>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs text-slate-400">
        ℹ️ La legislación argentina no establece un porcentaje fijo ni automático. El porcentaje debe ser ingresado por la persona profesional evaluando las necesidades acreditadas, el nivel de vida, el cuidado personal compartido y el criterio judicial del fuero.
      </div>

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
    <Card title="Sumador orientativo de rubros" subtitle="Herramienta de suma orientativa de rubros reclamados, con importes y porcentaje de interés ingresados manualmente.">
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
  const [instancia, setInstancia] = useState<CaducidadTipo>('primera');
  const [mesesPrescripcion, setMesesPrescripcion] = useState('2');
  const [res, setRes] = useState<CaducidadResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    if (!fecha) return setError('Ingresá la fecha del último acto de impulso.');

    try {
      const calculo = calcularCaducidadBase({
        fechaUltimoActo: fecha,
        tipo: instancia,
        mesesPrescripcionMenor: parseInt(mesesPrescripcion, 10) || 2,
      });
      setRes(calculo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al calcular la caducidad.');
    }
  };

  return (
    <Card title="Caducidad de instancia" subtitle="Plazos procesales del art. 310 CPCCN contados desde el último acto de impulso.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha del último acto de impulso">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold text-slate-400">Instancia / Proceso (art. 310 CPCCN)</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <RadioPill active={instancia === 'primera'} onClick={() => setInstancia('primera')} label="1ª o única instancia (6 meses — inc. 1)" />
          <RadioPill active={instancia === 'segunda'} onClick={() => setInstancia('segunda')} label="2ª o ulterior instancia (3 meses — inc. 2)" />
          <RadioPill active={instancia === 'sumarisimo_ejecucion_incidentes'} onClick={() => setInstancia('sumarisimo_ejecucion_incidentes')} label="Incidentes / Ejecución / Sumarísimo (3 meses — inc. 2)" />
          <RadioPill active={instancia === 'prescripcion_menor'} onClick={() => setInstancia('prescripcion_menor')} label="Prescripción menor (inc. 3)" />
          <RadioPill active={instancia === 'incidente_caducidad'} onClick={() => setInstancia('incidente_caducidad')} label="Incidente de caducidad (1 mes — inc. 4)" />
        </div>
      </div>

      {instancia === 'prescripcion_menor' && (
        <div className="mt-3">
          <Field label="Plazo de prescripción de la acción (meses si fuere menor)">
            <input type="number" min={1} max={5} value={mesesPrescripcion} onChange={(e) => setMesesPrescripcion(e.target.value)} className={inputClass} />
          </Field>
        </div>
      )}

      <MotionButton onClick={calcular} className={btnClass}>Calcular fecha base estimada</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-5">
          <ResultBox
            label="Fecha base estimada"
            value={formatDateLarga(res.fechaBaseEstimada)}
            subtitle={`${res.detalle} (${res.norma}) — ${res.meses} mes${res.meses !== 1 ? 'es' : ''}. ${res.aviso}.`}
            highlight
          />
        </div>
      )}
    </Card>
  );
}

// ── 💥 Daños punitivos ──────────────────────────────────────────
function DanosPunitivosCalc() {
  const [comp, setComp] = useState('');
  const [prob, setProb] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [res, setRes] = useState<null | { punitivo: number; total: number; compensatoria: number; advertencia: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    if (!confirmado) {
      return setError('Debés confirmar la comprensión del carácter doctrinario no vinculante de la fórmula.');
    }
    const C = parseMonto(comp);
    const p = parseFloat(prob.replace(',', '.')) / 100;
    if (!C || !p || p <= 0 || p > 1) {
      return setError('Completá la indemnización compensatoria y una probabilidad válida (1% a 100%).');
    }
    const calculo = calcularDanosPunitivos(C, p);
    setRes(calculo);
  };

  return (
    <Card
      title="Daños punitivos (Fórmula Irigoyen Testa)"
      subtitle="Simulación doctrinal — fórmula Irigoyen Testa. Art. 52 bis, Ley 24.240."
    >
      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1.5">
        <p className="font-semibold text-amber-300">
          ⚠️ El art. 52 bis de la Ley 24.240 no establece esta fórmula como método obligatorio de cuantificación.
        </p>
        <p>
          Constituye una construcción doctrinaria basada en análisis económico del derecho (D = C × (1 − Pc) / Pc). Los tribunales valoran la gravedad del hecho, la reincidencia, el beneficio obtenido y el tope legal.
        </p>
        <label className="flex items-center gap-2 pt-2 border-t border-amber-500/20 cursor-pointer font-medium text-slate-200">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="rounded border-amber-400/50 bg-slate-900 text-amber-500 focus:ring-amber-400"
          />
          <span>Confirmo que requiero la simulación con fines puramente orientativos y evaluaré el criterio judicial aplicable.</span>
        </label>
      </div>

      <Field label="Indemnización compensatoria (C)">
        <input className={inputClass} inputMode="decimal" placeholder="Ej: 1.000.000" value={comp} onChange={(e) => setComp(e.target.value)} />
      </Field>
      <div className="mt-3">
        <Field label="Probabilidad de condena Pc (%)">
          <input className={inputClass} inputMode="decimal" placeholder="Ej: 80" value={prob} onChange={(e) => setProb(e.target.value)} />
        </Field>
      </div>

      <MotionButton className={btnClass} onClick={calcular}>Simular daño punitivo</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-4 space-y-2">
          <ResultBox label="Resultado de la simulación doctrinal" value={currency(res.punitivo)} highlight />
          <ResultBox label="Indemnización compensatoria" value={currency(res.compensatoria)} />
          <ResultBox label="Total simulado (compensatoria + punitivo)" value={currency(res.total)} subtitle={res.advertencia} />
        </div>
      )}
    </Card>
  );
}

// ── 🏥 Incapacidad sobreviniente ─────────────────────────────────
function IncapacidadCalc() {
  const [metodo, setMetodo] = useState<'vuoto' | 'mendez'>('mendez');
  const [ingreso, setIngreso] = useState('');
  const [edad, setEdad] = useState('');
  const [incap, setIncap] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [res, setRes] = useState<null | { capital: number; a: number; n: number; i: number; advertencia: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    if (!confirmado) {
      return setError('Debés confirmar que la fórmula no reemplaza la valoración integral del art. 1746 CCyCN.');
    }
    const ing = parseMonto(ingreso);
    const ed = parseInt(edad, 10);
    const inc = parseFloat(incap.replace(',', '.')) / 100;
    if (!ing || !ed || !inc || inc <= 0 || inc > 1) {
      return setError('Completá ingreso mensual, edad y porcentaje de incapacidad válido (1% a 100%).');
    }

    try {
      const calculo = calcularIncapacidad(metodo, ing, ed, inc);
      setRes(calculo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al calcular el capital.');
    }
  };

  return (
    <Card title="Indemnización por incapacidad" subtitle="Fórmulas orientativas Vuoto (i 6%, tope 65) y Méndez (i 4%, tope 75). C = a × (1 − Vⁿ)/i.">
      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
        <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-200">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 rounded border-amber-400/50 bg-slate-900 text-amber-500 focus:ring-amber-400"
          />
          <span>Entiendo que la fórmula no reemplaza la valoración integral del art. 1746 CCyCN ni el criterio judicial aplicable.</span>
        </label>
      </div>

      <Field label="Método">
        <div className="flex flex-wrap gap-2">
          <RadioPill active={metodo === 'mendez'} onClick={() => setMetodo('mendez')} label="Méndez (2008)" />
          <RadioPill active={metodo === 'vuoto'} onClick={() => setMetodo('vuoto')} label="Vuoto (1978)" />
        </div>
      </Field>
      <div className="mt-3">
        <Field label="Ingreso mensual">
          <input className={inputClass} inputMode="decimal" placeholder="Ej: 800.000" value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Edad al momento del hecho">
          <input className={inputClass} inputMode="numeric" placeholder="Ej: 35" value={edad} onChange={(e) => setEdad(e.target.value)} />
        </Field>
        <Field label="% de incapacidad">
          <input className={inputClass} inputMode="decimal" placeholder="Ej: 30" value={incap} onChange={(e) => setIncap(e.target.value)} />
        </Field>
      </div>

      <MotionButton className={btnClass} onClick={calcular}>Calcular capital</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-4 space-y-2">
          <ResultBox label="Capital matemático orientativo" value={currency(res.capital)} highlight />
          <div className="text-[11px] text-amber-200 mt-1 mb-2">
            ⚠️ Este cálculo muestra únicamente el capital matemático de base. No incluye intereses moratorios ni daño moral o no patrimonial (art. 1741 CCyCN).
          </div>
          <ResultBox label="Renta anual base (a)" value={currency(res.a)} />
          <ResultBox label="Años computados (n)" value={`${res.n} años · tasa ${(res.i * 100).toFixed(0)}%`} subtitle={res.advertencia} />
        </div>
      )}
    </Card>
  );
}

// ── 📍 Ampliación por distancia ─────────────────────────────────
function AmpliacionDistanciaCalc() {
  const [base, setBase] = useState('');
  const [km, setKm] = useState('');
  const [res, setRes] = useState<null | { adicionales: number; total: number }>(null);

  const calcular = () => {
    const b = parseInt(base, 10);
    const d = parseFloat(km.replace(/\./g, '').replace(',', '.'));
    if (isNaN(b) || isNaN(d) || d < 0) { setRes(null); return; }
    const full = Math.floor(d / 200);
    const resto = d - full * 200;
    const extra = resto >= 100 ? 1 : 0;
    const adicionales = full + extra;
    setRes({ adicionales, total: b + adicionales });
  };

  return (
    <Card
      title="Ampliación de plazo por distancia"
      subtitle="Jurisdicción fija: Justicia Nacional/Federal — art. 158 CPCCN. 1 día cada 200 km (o fracción ≥ 100 km). Acordada CSJN 5/2010."
    >
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">
        ℹ️ Ámbito de aplicación exclusivo: <strong>Justicia Nacional y Federal</strong> (art. 158 CPCCN). No se ofrece ni sugiere aplicación provincial automática. Diversas provincias han derogado o sustituido este instituto con la digitalización de notificaciones.
      </div>

      <Field label="Plazo base (días)">
        <input className={inputClass} inputMode="numeric" placeholder="Ej: 5" value={base} onChange={(e) => setBase(e.target.value)} />
      </Field>
      <div className="mt-3">
        <Field label="Distancia (km)">
          <input className={inputClass} inputMode="decimal" placeholder="Ej: 650" value={km} onChange={(e) => setKm(e.target.value)} />
        </Field>
      </div>

      <MotionButton className={btnClass} onClick={calcular}>Calcular ampliación</MotionButton>

      {res && (
        <div className="mt-4 space-y-2">
          <ResultBox label="Días adicionales por distancia" value={`${res.adicionales} días`} />
          <ResultBox label="Plazo total ampliado" value={`${res.total} días`} highlight subtitle="Válido exclusivamente para Justicia Nacional y Federal conforme art. 158 CPCCN." />
        </div>
      )}
    </Card>
  );
}

// ── 📊 Prorrateo de honorarios (Tope 25%) ───────────────────────
function ProrrateoCalc() {
  const [monto, setMonto] = useState('');
  const [honorarios, setHonorarios] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [res, setRes] = useState<null | {
    tope: number;
    suma: number;
    excede: boolean;
    factor: number;
    aCargoCondenado: number;
    excedente: number;
    notaExcedente: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    setRes(null);
    if (!confirmado) {
      return setError('Debés confirmar que los conceptos incluidos corresponden a costas y honorarios alcanzados por el tope del art. 730 CCyCN.');
    }
    const m = parseMonto(monto);
    const h = parseMonto(honorarios);
    if (!m || !h) return setError('Ingresá el monto de condena y la suma total de honorarios regulados.');

    const calculo = calcularProrrateo(m, h);
    setRes({
      tope: calculo.tope25,
      suma: calculo.totalHonorarios,
      excede: calculo.excedeTope,
      factor: calculo.factorProrrateo,
      aCargoCondenado: calculo.aCargoCondenado,
      excedente: calculo.excedente,
      notaExcedente: calculo.notaExcedente,
    });
  };

  return (
    <Card
      title="Prorrateo de honorarios (tope 25%)"
      subtitle="Art. 730 CCyCN: las costas a cargo del condenado no superan el 25% del monto de la sentencia. Pauta orientativa; no constituye distribución definitiva de obligaciones."
    >
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300">
        <label className="flex items-start gap-2 cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
          />
          <span>Confirmo que los conceptos corresponden a costas y honorarios alcanzados por el tope legal del art. 730 CCyCN (excluyendo defensas de la contraparte o pactos contractuales autónomos).</span>
        </label>
      </div>

      <Field label="Monto de la sentencia / liquidación ($)">
        <input className={inputClass} inputMode="decimal" placeholder="Ej: 10.000.000" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </Field>
      <div className="mt-3">
        <Field label="Suma total de honorarios regulados ($)">
          <input className={inputClass} inputMode="decimal" placeholder="Ej: 3.500.000" value={honorarios} onChange={(e) => setHonorarios(e.target.value)} />
        </Field>
      </div>

      <MotionButton className={btnClass} onClick={calcular}>Calcular prorrateo</MotionButton>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {res && (
        <div className="mt-4 space-y-2">
          <ResultBox label="Tope legal (25% s/ sentencia)" value={currency(res.tope)} highlight />
          {res.excede ? (
            <>
              <ResultBox label="Factor de prorrateo" value={`${(res.factor * 100).toFixed(2)}%`} />
              <ResultBox label="A cargo del condenado" value={currency(res.aCargoCondenado)} />
              <ResultBox label="Excedente sobre el tope del 25%" value={currency(res.excedente)} subtitle={res.notaExcedente} />
            </>
          ) : (
            <ResultBox label="A cargo del condenado" value={currency(res.aCargoCondenado)} subtitle="Los honorarios no superan el tope del 25%: se abonan íntegramente sin prorrateo." />
          )}
        </div>
      )}
    </Card>
  );
}

// ── 🤝 Mediación prejudicial obligatoria ────────────────────────
const fmtARS = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

function MediacionTab() {
  const [juris, setJuris] = useState<'nacion' | 'baires' | 'corrientes'>('nacion');
  const [confirmado, setConfirmado] = useState(false);

  // Nación
  const [uhom, setUhom] = useState(String(UHOM_VALOR));
  const [tipoNac, setTipoNac] = useState<TipoMediacionNacion>('patrimonial');
  const [montoNac, setMontoNac] = useState('');
  const [audNac, setAudNac] = useState('1');

  // Buenos Aires
  const [jusBA, setJusBA] = useState(String(JUS_BA_MEDIACION));
  const [indetBA, setIndetBA] = useState(false);
  const [montoBA, setMontoBA] = useState('');

  // Corrientes
  const [jusC, setJusC] = useState(String(JUS_CORRIENTES));
  const [resC, setResC] = useState<ResultadoMediacionCtes>('acuerdo');
  const [tipoC, setTipoC] = useState<TipoMediacionCtes>('patrimonial');
  const [montoC, setMontoC] = useState('');
  const [cuotaC, setCuotaC] = useState('');

  const rNac =
    confirmado && Number.isFinite(parseMonto(montoNac)) && parseMonto(montoNac) > 0
      ? calcMediacionNacion({
          tipo: tipoNac,
          monto: parseMonto(montoNac),
          audiencias: Number(audNac) || 1,
          valorUHOM: Number(uhom) || UHOM_VALOR,
        })
      : null;

  const rBA = confirmado
    ? Number.isFinite(parseMonto(montoBA)) && parseMonto(montoBA) > 0
      ? calcMediacionBA({
          monto: parseMonto(montoBA),
          indeterminado: indetBA,
          valorJus: Number(jusBA) || JUS_BA_MEDIACION,
        })
      : indetBA
      ? calcMediacionBA({ monto: 0, indeterminado: indetBA, valorJus: Number(jusBA) || JUS_BA_MEDIACION })
      : null
    : null;

  const rC =
    confirmado &&
    ((Number.isFinite(parseMonto(montoC)) && parseMonto(montoC) > 0) ||
      (tipoC === 'alimentaria' && Number.isFinite(parseMonto(cuotaC)) && parseMonto(cuotaC) > 0) ||
      tipoC === 'sin_valor')
      ? calcMediacionCorrientes({
          resultado: resC,
          tipo: tipoC,
          monto: parseMonto(montoC),
          cuotaMensual: parseMonto(cuotaC),
          valorJus: Number(jusC) || JUS_CORRIENTES,
        })
      : null;

  return (
    <Card title="Honorarios de mediación">
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-xs font-semibold text-amber-300">
          ⚠️ Parámetros arancelarios de mediación — Verificación requerida
        </p>
        <p className="mt-1 text-xs text-amber-200/90">
          Valores oficiales vigentes de referencia: UHOM Nación ({currency(UHOM_VALOR)}, verificado al 01/08/2026, tabla CPACF), Jus Ley 14.967 PBA ({currency(JUS_BA_MEDIACION)}, verificado al 01/08/2026, Res. SCBA RP 873/26; escala Decreto 600/21 art. 31) y Jus Corrientes ({currency(JUS_CORRIENTES)}, orientativo al 01/05/2026). Requiere confirmación profesional para habilitar el cálculo orientativo.
        </p>
        <label className="mt-3 flex items-start gap-2.5 cursor-pointer text-xs text-slate-200 font-medium">
          <input
            type="checkbox"
            data-testid="mediacion-confirmar-checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 rounded border-amber-400/50 bg-slate-900 text-amber-500 focus:ring-amber-400"
          />
          <span>
            Confirmo que revisé la resolución o acordada arancelaria vigente en la jurisdicción correspondiente y habilito el cálculo orientativo bajo supervisión profesional.
          </span>
        </label>
      </div>

      <div className="block mb-4">
        <span className="mb-1 block text-xs font-semibold text-slate-400">Jurisdicción</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <RadioPill active={juris === 'nacion'} onClick={() => setJuris('nacion')} label="Nación" />
          <RadioPill active={juris === 'baires'} onClick={() => setJuris('baires')} label="Buenos Aires" />
          <RadioPill active={juris === 'corrientes'} onClick={() => setJuris('corrientes')} label="Corrientes" />
        </div>
      </div>

      {/* ---------- NACIÓN ---------- */}
      {juris === 'nacion' && (
        <div className="space-y-4">
          <Field label="Valor UHOM ($)">
            <input className={inputClass} value={uhom} onChange={(e) => setUhom(e.target.value)} type="number" />
          </Field>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Tipo de asunto</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={tipoNac === 'patrimonial'} onClick={() => setTipoNac('patrimonial')} label="Patrimonial" />
              <RadioPill active={tipoNac === 'familia'} onClick={() => setTipoNac('familia')} label="Familia" />
              <RadioPill active={tipoNac === 'indeterminable'} onClick={() => setTipoNac('indeterminable')} label="Indeterminable" />
              <RadioPill active={tipoNac === 'sin_valor'} onClick={() => setTipoNac('sin_valor')} label="Sin valor" />
            </div>
          </div>

          {tipoNac === 'patrimonial' && (
            <Field label="Monto del asunto ($)">
              <input className={inputClass} value={montoNac} onChange={(e) => setMontoNac(e.target.value)} />
            </Field>
          )}

          <Field label="Cantidad de audiencias">
            <input className={inputClass} value={audNac} onChange={(e) => setAudNac(e.target.value)} type="number" />
          </Field>

          {!confirmado ? (
            <div data-testid="mediacion-bloqueada" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              🔒 Cálculo bloqueado: confirmá la revisión del parámetro normativo en la casilla superior para calcular.
            </div>
          ) : rNac ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ResultBox label="Ítem de escala" value={rNac.item} />
              <ResultBox label="Honorario básico" value={`${rNac.basicoUHOM.toFixed(2)} UHOM`} subtitle={fmtARS(rNac.basicoPesos)} />
              <ResultBox label="Adicional por audiencias" value={`${rNac.adicUHOM.toFixed(2)} UHOM`} subtitle={fmtARS(rNac.adicPesos)} />
              <ResultBox label="Honorario provisional (2 UHOM)" value={fmtARS(rNac.provisionalPesos)} />
              <div className="sm:col-span-2">
                <ResultBox label="TOTAL estimado" value={fmtARS(rNac.totalPesos)} highlight={true} />
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">Completá el monto para ver el cálculo.</div>
          )}
        </div>
      )}

      {/* ---------- BUENOS AIRES ---------- */}
      {juris === 'baires' && (
        <div className="space-y-4">
          <Field label="Valor Jus Ley 14.967 PBA ($)">
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

          {!confirmado ? (
            <div data-testid="mediacion-bloqueada" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              🔒 Cálculo bloqueado: confirmá la revisión del parámetro normativo en la casilla superior para calcular.
            </div>
          ) : rBA ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ResultBox label="Tramo (art. 31 Dec. 600/21)" value={rBA.tramo} />
                <ResultBox label="Anticipo (1 Jus)" value={fmtARS(rBA.anticipoPesos)} />
              </div>
              <div className="mt-3">
                <ResultBox label="Honorario" value={`${rBA.honJus.toFixed(2)} Jus`} subtitle={fmtARS(rBA.honPesos)} highlight={true} />
              </div>
            </>
          ) : (
            <div className="mt-4 text-sm text-slate-400">Completá el monto para ver el cálculo.</div>
          )}

          <p className="text-xs text-slate-500 mt-2">⚠️ En Buenos Aires las causas de familia (divorcio, alimentos, etc.) están excluidas de la mediación previa obligatoria.</p>
        </div>
      )}

      {/* ---------- CORRIENTES ---------- */}
      {juris === 'corrientes' && (
        <div className="space-y-4">
          <Field label="Valor Jus Corrientes ($)">
            <input className={inputClass} value={jusC} onChange={(e) => setJusC(e.target.value)} type="number" />
          </Field>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Resultado de la mediación</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={resC === 'acuerdo'} onClick={() => setResC('acuerdo')} label="Con acuerdo" />
              <RadioPill active={resC === 'sin_acuerdo'} onClick={() => setResC('sin_acuerdo')} label="Sin acuerdo" />
            </div>
          </div>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Tipo de asunto</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <RadioPill active={tipoC === 'patrimonial'} onClick={() => setTipoC('patrimonial')} label="Patrimonial" />
              <RadioPill active={tipoC === 'alimentaria'} onClick={() => setTipoC('alimentaria')} label="Cuota alimentaria" />
              <RadioPill active={tipoC === 'sin_valor'} onClick={() => setTipoC('sin_valor')} label="Sin contenido patrimonial" />
            </div>
          </div>

          {tipoC === 'patrimonial' && (
            <Field label="Monto ($)">
              <input className={inputClass} value={montoC} onChange={(e) => setMontoC(e.target.value)} />
            </Field>
          )}
          {tipoC === 'alimentaria' && (
            <Field label="Cuota mensual ($)">
              <input className={inputClass} value={cuotaC} onChange={(e) => setCuotaC(e.target.value)} />
            </Field>
          )}

          {!confirmado ? (
            <div data-testid="mediacion-bloqueada" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              🔒 Cálculo bloqueado: confirmá la revisión del parámetro normativo en la casilla superior para calcular.
            </div>
          ) : rC ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ResultBox label="Cálculo" value={rC.detalle} />
              <ResultBox label="Honorario" value={`${rC.honJus.toFixed(2)} Jus`} subtitle={fmtARS(rC.honPesos)} highlight={true} />
              {rC.aplicaMinimo && <ResultBox label="Nota" value="Se aplicó el honorario mínimo de 1 Jus" />}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">Completá los montos para ver el cálculo.</div>
          )}
        </div>
      )}

      <div className="mt-5 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
        <p className="text-xs text-yellow-600/90 font-medium">
          ⚠️ Valor de referencia precargado. Verificá su vigencia, jurisdicción y fuente oficial antes de utilizarlo. El valor puede editarse.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Honorarios mínimos indicativos. Nación: Ley 26.589 (CABA/Justicia Nacional). Buenos Aires: Ley 13.951 + Decreto 600/21 art. 31 (Jus Ley 14.967 PBA).
          Corrientes: Ley 5931 + Acuerdo 14/22 del STJ (art. 18 RIM).
        </p>
      </div>
    </Card>
  );
}

// ── 🚀 Componente Principal ─────────────────────────────────────
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
        <p className="mt-1 text-sm text-slate-400">
          Cálculos jurídicos orientativos según la jurisdicción y los parámetros indicados en cada herramienta. Verificá normativa, valores oficiales, calendario y criterio judicial aplicable antes de utilizar el resultado.
        </p>
      </div>

      <MotionCard index={0} className="flex items-start gap-3 border-amber-500/20 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200">
          Resultados <strong>estimativos y no vinculantes</strong>. Verificá siempre normativa, valores oficiales vigentes, acordadas, calendario judicial y criterio tribunalicio aplicable antes de utilizar cualquier cálculo en presentaciones formales.
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
