'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  IdentificationBadge,
  Info,
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

export function NewOperationForm({ caseFields, caseStatuses, caseTypes, properties }: Props) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [caseType, setCaseType] = useState(caseTypes[0] ?? '');
  const [propertyId, setPropertyId] = useState('');

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
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-white/12 bg-white/[0.025] px-4 font-ui text-xs font-bold text-[#B9C7C2] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
        >
          <ArrowLeft size={15} /> Volver a operaciones
        </Link>
      </header>

      <form action={createCase} className="mt-6 overflow-hidden rounded-xl border border-white/[0.09] bg-[#091411] shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
        <div className="border-b border-white/[0.07] px-4 py-4 sm:px-6">
          <ol className="grid gap-2 sm:grid-cols-3" aria-label="Progreso de creación">
            {steps.map((item) => {
              const active = step === item.id;
              const complete = step > item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${
                      active
                        ? 'border-[#85E4D4]/35 bg-[#85E4D4]/[0.07]'
                        : 'border-transparent bg-transparent hover:border-white/[0.07] hover:bg-white/[0.025]'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md font-display text-xs font-semibold ${
                        complete
                          ? 'bg-[#C8FF62] text-[#071110]'
                          : active
                            ? 'border border-[#85E4D4]/35 bg-[#85E4D4]/10 text-[#B7F0E6]'
                            : 'border border-white/10 text-[#6F817B]'
                      }`}
                    >
                      {complete ? <Check size={15} weight="bold" /> : item.id}
                    </span>
                    <span>
                      <span className={`block font-ui text-xs font-bold ${active ? 'text-[#E8F0ED]' : 'text-[#8FA19B]'}`}>{item.label}</span>
                      <span className="mt-0.5 block font-ui text-[10px] text-[#60736D]">{item.helper}</span>
                    </span>
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
                      {caseTypes.map((type) => (
                        <label
                          key={type}
                          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 transition ${
                            caseType === type
                              ? 'border-[#85E4D4]/40 bg-[#85E4D4]/[0.07]'
                              : 'border-white/[0.09] bg-[#07110F] hover:border-white/[0.16]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="case_type"
                            value={type}
                            checked={caseType === type}
                            onChange={() => setCaseType(type)}
                            className="sr-only"
                          />
                          <span className={`grid h-8 w-8 place-items-center rounded-md ${caseType === type ? 'bg-[#85E4D4]/10 text-[#85E4D4]' : 'bg-white/[0.035] text-[#70827C]'}`}>
                            <Buildings size={16} />
                          </span>
                          <span className="font-ui text-xs font-bold text-[#DCE6E2]">{type}</span>
                          {caseType === type ? <Check className="ml-auto text-[#C8FF62]" size={15} weight="bold" /> : null}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Estado inicial
                    <select name="status" defaultValue={caseStatuses[0]?.value ?? 'active'} className={inputClass}>
                      {caseStatuses.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
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

                  <label className="font-ui text-xs font-bold text-[#B8C6C1]">
                    Propiedad asociada
                    <select name="property_id" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className={inputClass}>
                      <option value="">Sin propiedad asociada</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name} {property.address ? `— ${property.address}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

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
                  {caseFields.map((field) => (
                    <label key={field.key} className={`font-ui text-xs font-bold text-[#B8C6C1] ${field.key === 'direccion_inmueble' || field.key === 'contraparte' ? 'sm:col-span-2' : ''}`}>
                      {field.label}
                      {field.type === 'select' ? (
                        <select name={`case_metadata.${field.key}`} className={inputClass}>
                          <option value="">Sin definir</option>
                          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input name={`case_metadata.${field.key}`} type={field.type} className={inputClass} />
                      )}
                    </label>
                  ))}
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

              <div className="mt-6 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="font-ui text-[10px] leading-4 text-[#60736D]">Podrás agregar checklist, documentos, recordatorios y participantes al abrir la operación.</p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/[0.07] bg-[#07110F]/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={previous}
            disabled={step === 1}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 px-4 font-ui text-xs font-bold text-[#AAB9B4] transition hover:border-white/20 hover:bg-white/[0.045] hover:text-white disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
          >
            <ArrowLeft size={15} /> Anterior
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/60 bg-[#F3F8F5] px-5 font-ui text-xs font-bold text-[#071110] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(200,255,98,0.22),0_0_18px_rgba(200,255,98,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
            >
              Continuar <ArrowRight size={15} weight="bold" />
            </button>
          ) : (
            <button
              type="submit"
              data-testid="case-submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/60 bg-[#F3F8F5] px-5 font-ui text-xs font-bold text-[#071110] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(200,255,98,0.22),0_0_18px_rgba(200,255,98,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
            >
              <Plus size={16} weight="bold" /> Crear operación
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}