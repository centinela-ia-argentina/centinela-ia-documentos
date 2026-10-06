'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkSimple,
  Buildings,
  CaretDown,
  Check,
  DotsThree,
  HouseLine,
  IdentificationBadge,
  Info,
  Key,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';
import type { CaseFieldDef, CaseStatusDef } from '@/lib/industries/caseConfig';
import { createCase } from '@/app/expedientes/actions';

type PropertyOption = {
  id: string;
  name: string;
  address?: string | null;
};

type Props = {
  caseFields: CaseFieldDef[];
  caseStatuses: CaseStatusDef[];
  caseTypes: string[];
  properties: PropertyOption[];
};

const steps = [
  { id: 1, label: 'Operación', helper: 'Tipo y referencia' },
  { id: 2, label: 'Vinculación', helper: 'Cliente y propiedad' },
  { id: 3, label: 'Condiciones', helper: 'Datos y revisión' },
];

const inputClass =
  'mt-2 min-h-12 w-full rounded-lg border border-white/[0.11] bg-[#07110F] px-4 font-ui text-sm text-[#E8F0ED] outline-none transition placeholder:text-[#52655F] focus:border-[#85E4D4]/55 focus:ring-2 focus:ring-[#85E4D4]/15';

type SelectOption = {
  value: string;
  label: string;
  detail?: string;
};

type ModernSelectProps = {
  name: string;
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  placeholder: string;
  icon?: ReactNode;
  onChange?: (value: string) => void;
};

function ModernSelect({
  name,
  value,
  defaultValue = '',
  options,
  placeholder,
  icon,
  onChange,
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentValue = value ?? internalValue;
  const selected = options.find((option) => option.value === currentValue);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function choose(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative mt-2">
      <input type="hidden" name={name} value={currentValue} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`group flex min-h-12 w-full items-center gap-3 rounded-lg border px-3.5 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${
          open
            ? 'border-[#85E4D4]/45 bg-[#0B1815] shadow-[0_0_0_3px_rgba(133,228,212,0.08)]'
            : 'border-white/[0.11] bg-[#07110F] hover:border-white/[0.22] hover:bg-white/[0.025]'
        }`}
      >
        {icon ? (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.035] text-[#85E4D4]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-display text-sm font-medium tracking-[-0.015em] ${selected ? 'text-[#E1EAE7]' : 'text-[#71857F]'}`}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.detail ? <span className="mt-0.5 block truncate font-ui text-[10px] text-[#61736D]">{selected.detail}</span> : null}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/[0.08] text-[#8FA19B] transition-transform ${open ? 'rotate-180 bg-white/[0.05] text-white' : 'group-hover:text-white'}`}>
          <CaretDown size={13} weight="bold" />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-[#85E4D4]/18 bg-[#0A1613]/98 p-1.5 shadow-[0_24px_64px_rgba(0,0,0,0.48)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const active = option.value === currentValue;
            return (
              <button
                key={`${name}-${option.value}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(option.value)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62] ${
                  active ? 'bg-[#85E4D4]/[0.09]' : 'hover:bg-white/[0.045]'
                }`}
              >
                <span className={`h-5 w-[3px] rounded-full ${active ? 'bg-[#C8FF62]' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-ui text-xs font-bold ${active ? 'text-[#E8F0ED]' : 'text-[#B8C6C1]'}`}>{option.label}</span>
                  {option.detail ? <span className="mt-0.5 block truncate font-ui text-[10px] text-[#61736D]">{option.detail}</span> : null}
                </span>
                {active ? <Check size={14} weight="bold" className="shrink-0 text-[#C8FF62]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function operationTypeVisual(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('compra') || normalized.includes('venta')) {
    return { icon: <HouseLine size={18} />, helper: 'Venta y transferencia del inmueble' };
  }
  if (normalized.includes('alquiler') || normalized.includes('locaci')) {
    return { icon: <Key size={18} />, helper: 'Locación y seguimiento contractual' };
  }
  if (normalized.includes('reserva')) {
    return { icon: <BookmarkSimple size={18} />, helper: 'Oferta, reserva y negociación' };
  }
  return { icon: <DotsThree size={18} weight="bold" />, helper: 'Flujo inmobiliario personalizado' };
}

export function NewOperationForm({ caseFields, caseStatuses, caseTypes, properties }: Props) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [caseType, setCaseType] = useState(caseTypes[0] ?? '');
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState(caseStatuses[0]?.value ?? 'active');

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId),
    [properties, propertyId],
  );

  const next = () => setStep((current) => Math.min(3, current + 1));
  const previous = () => setStep((current) => Math.max(1, current - 1));

  return (
    <div className="mx-auto max-w-6xl py-2 sm:py-3">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ui text-xs font-semibold text-[#85E4D4]">Cartera · Gestión inmobiliaria</p>
          <h1 className="mt-2 font-display text-[clamp(2.35rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.06em] text-[#F3F8F5]">
            Nueva operación
          </h1>
          <p className="mt-4 max-w-2xl font-ui text-sm font-medium leading-6 text-[#B8C6C1] sm:text-[16px]">
            Registrá la información esencial ahora. Podrás completar documentos, fechas y seguimiento después.
          </p>
        </div>
        <Link
          href="/operaciones"
          className="group inline-flex min-h-12 w-fit items-center gap-3 rounded-md border border-white/20 bg-white/[0.045] px-2.5 pr-4 font-ui text-xs font-bold text-[#D5E0DC] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-white/35 hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[5px] border border-white/[0.09] bg-[#07110F] text-[#85E4D4] transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={15} weight="bold" />
          </span>
          Volver a operaciones
        </Link>
      </header>

      <form action={createCase} className="mt-6 rounded-xl border border-white/[0.09] bg-[#091411] shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
        <div className="border-b border-white/[0.07] px-4 sm:px-6">
          <ol className="grid grid-cols-3" aria-label="Progreso de creación">
            {steps.map((item) => {
              const active = step === item.id;
              const complete = step > item.id;
              return (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    aria-current={active ? 'step' : undefined}
                    className={`group relative flex min-h-[72px] w-full flex-col items-start justify-center gap-1.5 px-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62] sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:px-3 ${
                      active ? 'text-[#F3F8F5]' : 'text-[#82948E] hover:text-[#C7D3CF]'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-xs font-semibold transition-colors ${
                        complete
                          ? 'border-[#C8FF62] bg-[#C8FF62] text-[#071110]'
                          : active
                            ? 'border-[#85E4D4]/55 bg-[#85E4D4]/10 text-[#C7F4EC]'
                            : 'border-white/10 bg-white/[0.015] text-[#62756F] group-hover:border-white/20'
                      }`}
                    >
                      {complete ? <Check size={15} weight="bold" /> : item.id}
                    </span>
                    <span>
                      <span className="block font-display text-sm font-medium tracking-[-0.02em]">{item.label}</span>
                      <span className="mt-0.5 hidden font-ui text-[10px] text-[#60736D] min-[460px]:block">{item.helper}</span>
                    </span>
                    <span className={`absolute inset-x-2 bottom-0 h-[2px] origin-left transition-transform duration-200 ${active ? 'scale-x-100 bg-[#85E4D4]' : 'scale-x-0 bg-transparent'}`} />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">
            {step === 1 ? (
              <section aria-labelledby="operation-step-title">
                <div className="mb-7">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#85E4D4]">Paso 1 de 3</p>
                  <h2 id="operation-step-title" className="mt-2 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">Identificá la operación</h2>
                  <p className="mt-2 max-w-xl font-ui text-sm leading-6 text-[#7F938D]">Usá un nombre reconocible y elegí el flujo que corresponde.</p>
                </div>

                <div className="grid gap-5">
                  <label className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Nombre de la operación <span className="text-[#C8FF62]">*</span>
                    <input
                      name="title"
                      data-testid="case-title"
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ej. Compraventa Palermo"
                      className={inputClass}
                    />
                    <span className="mt-2 block text-[10px] font-normal leading-4 text-[#60736D]">Será el nombre principal en la cartera y en los documentos asociados.</span>
                  </label>

                  <fieldset>
                    <legend className="font-ui text-xs font-bold text-[#B8C6C1]">Tipo de operación</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {caseTypes.map((type) => {
                        const visual = operationTypeVisual(type);
                        const selected = caseType === type;
                        return (
                          <label
                            key={type}
                            className={`group relative flex min-h-[72px] cursor-pointer items-center gap-3 overflow-hidden rounded-lg border px-3 transition-[border-color,background-color,transform] hover:-translate-y-px ${
                              selected
                                ? 'border-[#85E4D4]/45 bg-[#85E4D4]/[0.07]'
                                : 'border-white/[0.09] bg-[#07110F] hover:border-white/[0.2] hover:bg-white/[0.02]'
                            }`}
                          >
                            <input type="radio" name="case_type" value={type} checked={selected} onChange={() => setCaseType(type)} className="sr-only" />
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${selected ? 'border-[#85E4D4]/25 bg-[#85E4D4]/10 text-[#9DEADB]' : 'border-white/[0.07] bg-white/[0.025] text-[#71857F] group-hover:text-[#A9BBB5]'}`}>
                              {visual.icon}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-display text-sm font-medium tracking-[-0.02em] text-[#DCE6E2]">{type}</span>
                              <span className="mt-0.5 block truncate font-ui text-[10px] text-[#61736D]">{visual.helper}</span>
                            </span>
                            <span className={`absolute right-0 top-0 h-full w-[3px] ${selected ? 'bg-[#C8FF62]' : 'bg-transparent'}`} />
                            {selected ? <Check className="ml-auto shrink-0 text-[#C8FF62]" size={15} weight="bold" /> : null}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Estado inicial
                    <ModernSelect
                      name="status"
                      value={status}
                      onChange={setStatus}
                      placeholder="Seleccionar estado"
                      icon={<Buildings size={16} />}
                      options={caseStatuses.map((item) => ({ value: item.value, label: item.label, detail: 'Estado visible en la cartera' }))}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section aria-labelledby="link-step-title">
                <div className="mb-7">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#85E4D4]">Paso 2 de 3</p>
                  <h2 id="link-step-title" className="mt-2 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">Vinculá cliente y propiedad</h2>
                  <p className="mt-2 max-w-xl font-ui text-sm leading-6 text-[#7F938D]">Estos datos permiten encontrar y contextualizar la operación rápidamente.</p>
                </div>

                <div className="grid gap-5">
                  <label className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Cliente o contacto principal
                    <span className="relative mt-2 block">
                      <IdentificationBadge className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#70827C]" size={17} />
                      <input
                        name="client_name"
                        data-testid="case-client"
                        value={client}
                        onChange={(event) => setClient(event.target.value)}
                        placeholder="Nombre y apellido o razón social"
                        className={`${inputClass} mt-0 pl-11`}
                      />
                    </span>
                  </label>

                  <div className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Propiedad asociada
                    <ModernSelect
                      name="property_id"
                      value={propertyId}
                      onChange={setPropertyId}
                      placeholder="Seleccionar propiedad"
                      icon={<HouseLine size={17} />}
                      options={[
                        { value: '', label: 'Sin propiedad asociada', detail: 'Podrás vincularla más adelante' },
                        ...properties.map((property) => ({
                          value: property.id,
                          label: property.name,
                          detail: property.address || 'Dirección sin cargar',
                        })),
                      ]}
                    />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-[#85E4D4]/15 bg-[#85E4D4]/[0.04] p-4">
                    <Info className="mt-0.5 shrink-0 text-[#85E4D4]" size={17} />
                    <p className="font-ui text-xs leading-5 text-[#8FA19B]">Si la propiedad todavía no está cargada, podés crear la operación ahora y vincularla más adelante.</p>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section aria-labelledby="conditions-step-title">
                <div className="mb-7">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#85E4D4]">Paso 3 de 3</p>
                  <h2 id="conditions-step-title" className="mt-2 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">Completá las condiciones</h2>
                  <p className="mt-2 max-w-xl font-ui text-sm leading-6 text-[#7F938D]">Solo pedimos información útil para iniciar el seguimiento. Todo puede actualizarse después.</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {caseFields.map((field) => {
                    const spanClass = field.key === 'direccion_inmueble' || field.key === 'contraparte' ? 'sm:col-span-2' : '';
                    if (field.type === 'select') {
                      return (
                        <div key={field.key} className={`font-ui text-xs font-bold text-[#B8C6C1] ${spanClass}`}>
                          {field.label}
                          <ModernSelect
                            name={`case_metadata.${field.key}`}
                            placeholder="Sin definir"
                            icon={field.key === 'moneda_operacion' ? <span className="font-display text-sm font-semibold">$</span> : <ShieldCheck size={16} />}
                            options={[
                              { value: '', label: 'Sin definir', detail: 'Podés completarlo más adelante' },
                              ...(field.options ?? []).map((option) => ({
                                value: option,
                                label: option,
                                detail: field.key === 'moneda_operacion' ? 'Moneda de referencia' : 'Clasificación de acceso',
                              })),
                            ]}
                          />
                        </div>
                      );
                    }
                    return (
                      <label key={field.key} className={`font-ui text-xs font-bold text-[#B8C6C1] ${spanClass}`}>
                        {field.label}
                        <input name={`case_metadata.${field.key}`} type={field.type} className={inputClass} />
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200/15 bg-amber-300/[0.045] p-4">
                  <ShieldCheck className="mt-0.5 shrink-0 text-amber-200" size={18} />
                  <div>
                    <p className="font-ui text-xs font-bold text-amber-100">Revisá los datos antes de crear</p>
                    <p className="mt-1 font-ui text-xs leading-5 text-[#8FA19B]">La operación se crea dentro de tu organización y queda lista para agregar documentos y fechas.</p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="border-t border-white/[0.07] bg-[#07110F]/60 p-5 lg:border-l lg:border-t-0" aria-label="Resumen de la operación">
            <div className="sticky top-24">
              <div className="flex items-center justify-between">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#70827C]">Resumen</p>
                <Sparkle size={16} className="text-[#C8FF62]" />
              </div>
              <h3 className="mt-4 break-words font-display text-xl font-medium tracking-[-0.035em] text-[#E8F0ED]">{title || 'Operación sin nombre'}</h3>
              <p className="mt-1 font-ui text-xs text-[#85E4D4]">{caseType || 'Tipo sin definir'}</p>

              <dl className="mt-6 space-y-4 border-t border-white/[0.07] pt-5">
                <div>
                  <dt className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-[#52655F]">Cliente</dt>
                  <dd className="mt-1 font-display text-sm font-medium text-[#B8C6C1]">{client || 'Sin cliente'}</dd>
                </div>
                <div>
                  <dt className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-[#52655F]">Propiedad</dt>
                  <dd className="mt-1 flex items-start gap-2 font-display text-sm font-medium text-[#B8C6C1]">
                    <MapPin className="mt-0.5 shrink-0 text-[#70827C]" size={14} />
                    <span>{selectedProperty ? selectedProperty.name : 'Sin asociar'}</span>
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-white/[0.07] pt-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#85E4D4]/15 text-[#85E4D4]"><Plus size={12} weight="bold" /></span>
                  <div>
                    <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#70827C]">Después de crear</p>
                    <p className="mt-1 font-ui text-[10px] leading-4 text-[#60736D]">Agregá checklist, documentos, recordatorios y participantes desde el detalle.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#07110F]/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={previous}
            disabled={step === 1}
            className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/20 bg-white/[0.035] px-2.5 pr-4 font-ui text-xs font-bold text-[#C0CEC9] transition-[transform,border-color,background-color] hover:-translate-y-px hover:border-white/35 hover:bg-white/[0.065] hover:text-white disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[5px] border border-white/[0.08] bg-[#07110F] text-[#85E4D4] transition-transform group-hover:-translate-x-0.5"><ArrowLeft size={15} weight="bold" /></span>
            Anterior
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/70 bg-[#F3F8F5] px-2.5 pl-5 font-ui text-xs font-bold text-[#071110] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(200,255,98,0.22),0_0_20px_rgba(200,255,98,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
            >
              Continuar
              <span className="grid h-8 w-8 place-items-center rounded-[5px] bg-[#07110F] text-[#F3F8F5] transition-transform group-hover:translate-x-0.5"><ArrowRight size={15} weight="bold" /></span>
            </button>
          ) : (
            <button
              type="submit"
              data-testid="case-submit"
              className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-white/70 bg-[#F3F8F5] px-2.5 pl-5 font-ui text-xs font-bold text-[#071110] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(200,255,98,0.22),0_0_20px_rgba(200,255,98,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
            >
              Crear operación
              <span className="grid h-8 w-8 place-items-center rounded-[5px] bg-[#07110F] text-[#F3F8F5]"><Plus size={15} weight="bold" /></span>
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}