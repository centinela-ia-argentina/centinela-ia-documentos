'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
};

export type SelectFieldProps = {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  placeholder: string;
  icon?: ReactNode;
  onChange?: (value: string) => void;
};

export function SelectField({
  name,
  label,
  value,
  defaultValue = '',
  options,
  placeholder,
  icon,
  onChange,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentValue = value ?? internalValue;
  const selected = options.find((option) => option.value === currentValue);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
        ref={triggerRef}
        aria-label={label}
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
          aria-label={label}
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
