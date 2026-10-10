'use client';

import { Check } from '@phosphor-icons/react';

export type WorkflowStep = { id: number; label: string; helper: string };

export function WorkflowStepper({ steps, step, onStepChange }: {
  steps: WorkflowStep[];
  step: number;
  onStepChange: (step: number) => void;
}) {
  return (
          <ol className="grid grid-cols-3" aria-label="Progreso de creación">
            {steps.map((item) => {
              const active = step === item.id;
              const complete = step > item.id;
              return (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onStepChange(item.id)}
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
  );
}
