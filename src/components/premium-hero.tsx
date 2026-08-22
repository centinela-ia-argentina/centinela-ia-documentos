'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const trustItems = [
  'Beta operativa comercial',
  'Acceso por roles',
  'Documentos privados',
  'Actividad auditada',
];

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 950;

    const update = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display}</>;
}

function ProductMockup() {
  return (
    <div className="premium-panel-shell hero-enter hero-enter-panel">
      <div className="premium-panel-glow" aria-hidden="true" />
      <div className="premium-panel-float">
        <div className="premium-panel-scan" aria-hidden="true" />
        <div className="relative rounded-[1.45rem] border border-white/10 bg-[#050d1e]/95 p-4 shadow-2xl sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-sky-300">
                Centinela IA
              </p>
              <p className="mt-1 text-lg font-black text-white">Panel operativo</p>
            </div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[0.65rem] font-bold text-emerald-300">
              Beta activa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Expedientes', 3, 'activos'],
              ['Documentos', 8, 'cargados'],
              ['Análisis documental', 4, 'procesados'],
            ].map(([label, value, suffix]) => (
              <div key={label} className="premium-panel-card rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <p className="text-[0.62rem] font-bold uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black text-white">
                  <AnimatedNumber value={Number(value)} /> <span className="text-sm text-slate-300">{suffix}</span>
                </p>
              </div>
            ))}
            <div className="premium-panel-card rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-wide text-sky-200">Auditoría</p>
              <p className="mt-2 text-sm font-black text-white">Eventos trazables</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Bóveda documental</p>
              <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[0.65rem] font-bold text-sky-300">
                PDF privado
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {['Contrato_Alquiler_Demo.pdf', 'Compraventa_Inmobiliaria.pdf', 'Informe_Documental.pdf'].map((item) => (
                <div key={item} className="premium-panel-card flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.045] px-3 py-3">
                  <span className="truncate pr-3 text-xs font-semibold text-slate-200">{item}</span>
                  <span className="text-[0.65rem] font-bold text-emerald-300">Seguro</span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel-card mt-4 rounded-2xl border border-sky-200/20 bg-gradient-to-r from-sky-500 to-cyan-400 p-4 text-[#071426] shadow-[0_12px_35px_rgba(30,155,240,0.2)]">
            <p className="text-sm font-black">Análisis documental</p>
            <p className="mt-1 text-xs font-semibold leading-5">
              Clasificación, sensibilidad y revisión inicial en entorno controlado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PremiumHero() {
  return (
    <section id="inicio" className="premium-hero relative isolate overflow-hidden bg-[#0A1830] px-6 pb-16 pt-32 text-white sm:pb-20 sm:pt-36 lg:pb-24 lg:pt-40">
      <div className="premium-hero-grid" aria-hidden="true" />
      <div className="premium-hero-orb premium-hero-orb-left" aria-hidden="true" />
      <div className="premium-hero-orb premium-hero-orb-right" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
        <div>
          <div className="hero-enter hero-enter-1 inline-flex items-center gap-2.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.22em] text-sky-300 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_#1E9BF0]" />
            Gestión documental inteligente
          </div>

          <h1 className="hero-enter hero-enter-2 mt-7 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.035em] text-white sm:text-5xl lg:text-[4rem]">
            Toda tu documentación sensible: ordenada, segura y bajo{' '}
            <span className="premium-control-word">control.</span>
          </h1>

          <p className="hero-enter hero-enter-3 mt-6 max-w-[520px] text-base leading-8 text-[#C2CCD9] sm:text-lg">
            Centinela IA reúne tus expedientes y PDFs en un solo lugar, controla los accesos por usuario y organización y registra la actividad relevante, para que trabajes con menos dispersión, mayor trazabilidad y una imagen más profesional ante tus clientes.
          </p>

          <div className="hero-enter hero-enter-4 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/#contacto" className="premium-primary-button rounded-2xl bg-[#1E9BF0] px-6 py-4 text-center text-sm font-black text-[#061426] shadow-[0_12px_35px_rgba(30,155,240,0.25)]">
              Coordinar presentación
            </Link>
            <Link href="/como-funciona" className="premium-secondary-button rounded-2xl border border-white/25 bg-white/[0.03] px-6 py-4 text-center text-sm font-black text-white backdrop-blur-sm">
              Ver cómo funciona
            </Link>
          </div>

          <div className="hero-enter hero-enter-5 mt-7 flex max-w-2xl flex-wrap gap-x-5 gap-y-2.5 text-xs font-semibold text-slate-300 sm:text-sm">
            {trustItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sky-300/35 bg-sky-400/10 text-[0.6rem] text-sky-300">✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <ProductMockup />
      </div>
    </section>
  );
}
