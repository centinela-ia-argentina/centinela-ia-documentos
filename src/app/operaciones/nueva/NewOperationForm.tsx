'use client';

import { useMemo, useState } from 'react';
import { AppButton, AppButtonLink } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { Eyebrow, PageTitle, SectionTitle, SupportingCopy } from '@/components/ui/Typography';
import { WorkflowStepper } from '@/components/ui/WorkflowStepper';
import { SelectField } from '@/components/ui/SelectField';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkSimple,
  Buildings,
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
  const [metadata, setMetadata] = useState<Record<string, string>>({});

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
          <Eyebrow>Cartera · Gestión inmobiliaria</Eyebrow>
          <PageTitle className="mt-2">
            Nueva operación
          </PageTitle>
          <SupportingCopy variant="hero" className="mt-4">
            Registrá la información esencial ahora. Podrás completar documentos, fechas y seguimiento después.
          </SupportingCopy>
        </div>
        <AppButtonLink href="/operaciones" variant="secondary" appearance="navigation"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[5px] border border-white/[0.09] bg-[#07110F] text-[#85E4D4] transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={15} weight="bold" />
          </span>
          Volver a operaciones
        </AppButtonLink>
      </header>

      <Surface as="form" family="panel" action={createCase} className="mt-6"
        onSubmit={(event) => {
          if (!title.trim()) {
            event.preventDefault();
            const form = event.currentTarget;
            setStep(1);
            requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[name="title"]')?.focus());
          }
        }}
      >
        {/* Unmounted steps still contribute exactly one successful control per field. */}
        {step !== 1 ? <>
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="case_type" value={caseType} />
          <input type="hidden" name="status" value={status} />
        </> : null}
        {step !== 2 ? <>
          <input type="hidden" name="client_name" value={client} />
          <input type="hidden" name="property_id" value={propertyId} />
        </> : null}
        {step !== 3 ? caseFields.map((field) => (
          <input key={field.key} type="hidden" name={`case_metadata.${field.key}`} value={metadata[field.key] ?? ''} />
        )) : null}
        <div className="border-b border-white/[0.07] px-4 sm:px-6">
          <WorkflowStepper steps={steps} step={step} onStepChange={setStep} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">
            {step === 1 ? (
              <section aria-labelledby="operation-step-title">
                <div className="mb-7">
                  <Eyebrow variant="step">Paso 1 de 3</Eyebrow>
                  <SectionTitle id="operation-step-title" className="mt-2">Identificá la operación</SectionTitle>
                  <SupportingCopy className="mt-2">Usá un nombre reconocible y elegí el flujo que corresponde.</SupportingCopy>
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
                    <SelectField
                      label="Estado inicial"
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
                  <Eyebrow variant="step">Paso 2 de 3</Eyebrow>
                  <SectionTitle id="link-step-title" className="mt-2">Vinculá cliente y propiedad</SectionTitle>
                  <SupportingCopy className="mt-2">Estos datos permiten encontrar y contextualizar la operación rápidamente.</SupportingCopy>
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
                    <SelectField
                      label="Propiedad asociada"
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
                  <Eyebrow variant="step">Paso 3 de 3</Eyebrow>
                  <SectionTitle id="conditions-step-title" className="mt-2">Completá las condiciones</SectionTitle>
                  <SupportingCopy className="mt-2">Solo pedimos información útil para iniciar el seguimiento. Todo puede actualizarse después.</SupportingCopy>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {caseFields.map((field) => {
                    const spanClass = field.key === 'direccion_inmueble' || field.key === 'contraparte' ? 'sm:col-span-2' : '';
                    if (field.type === 'select') {
                      return (
                        <div key={field.key} className={`font-ui text-xs font-bold text-[#B8C6C1] ${spanClass}`}>
                          {field.label}
                          <SelectField
                            label={field.label}
                            name={`case_metadata.${field.key}`}
                            value={metadata[field.key] ?? ''}
                            onChange={(value) => setMetadata((current) => ({ ...current, [field.key]: value }))}
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
                        <input name={`case_metadata.${field.key}`} type={field.type} className={inputClass}
                          value={metadata[field.key] ?? ''}
                          onChange={(event) => setMetadata((current) => ({ ...current, [field.key]: event.target.value }))}
                        />
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
          <AppButton
            type="button"
            onClick={previous}
            disabled={step === 1}
            variant="secondary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[5px] border border-white/[0.08] bg-[#07110F] text-[#85E4D4] transition-transform group-hover:-translate-x-0.5"><ArrowLeft size={15} weight="bold" /></span>
            Anterior
          </AppButton>

          {step < 3 ? (
            <AppButton
              type="button"
              onClick={next}
              variant="primary"
            >
              Continuar
              <span className="grid h-8 w-8 place-items-center rounded-[5px] bg-[#07110F] text-[#F3F8F5] transition-transform group-hover:translate-x-0.5"><ArrowRight size={15} weight="bold" /></span>
            </AppButton>
          ) : (
            <AppButton
              type="submit"
              data-testid="case-submit"
              variant="primary"
            >
              Crear operación
              <span className="grid h-8 w-8 place-items-center rounded-[5px] bg-[#07110F] text-[#F3F8F5]"><Plus size={15} weight="bold" /></span>
            </AppButton>
          )}
        </footer>
      </Surface>
    </div>
  );
}