'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import styles from './SharedControls.module.css';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentValue = value ?? internalValue;
  const selected = options.find((option) => option.value === currentValue);

  function openMenu(fromEnd = false) {
    const selectedIndex = options.findIndex((option) => option.value === currentValue);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : fromEnd ? Math.max(0, options.length - 1) : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const option = optionRefs.current[activeIndex];
    option?.focus({ preventScroll: true });
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

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
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className="relative mt-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input type="hidden" name={name} value={currentValue} />
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp');
          }
        }}
        className={styles.selectTrigger}
      >
        {icon ? <span className={styles.selectIcon}>{icon}</span> : null}
        <span className={styles.selectValue}>
          <span className={`${styles.selectLabel}${selected ? '' : ` ${styles.selectPlaceholder}`}`}>{selected?.label ?? placeholder}</span>
          {selected?.detail ? <span className={styles.selectDetail}>{selected.detail}</span> : null}
        </span>
        <span className={styles.caret} aria-hidden="true"><CaretDown size={16} weight="regular" /></span>
      </button>

      {open ? (
        <div
          id={listId}
          aria-label={label}
          role="listbox"
          className={styles.popup}
        >
          {options.map((option, index) => {
            const active = option.value === currentValue;
            return (
              <button
                key={`${name}-${option.value}`}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  let nextIndex: number;
                  switch (event.key) {
                    case 'ArrowDown': nextIndex = Math.min(options.length - 1, index + 1); break;
                    case 'ArrowUp': nextIndex = Math.max(0, index - 1); break;
                    case 'Home': nextIndex = 0; break;
                    case 'End': nextIndex = options.length - 1; break;
                    default: return;
                  }
                  event.preventDefault();
                  setActiveIndex(nextIndex);
                }}
                aria-selected={active}
                onClick={() => choose(option.value)}
                className={styles.option}
              >
                <span className={styles.selectValue}>
                  <span className={styles.selectLabel}>{option.label}</span>
                  {option.detail ? <span className={styles.selectDetail}>{option.detail}</span> : null}
                </span>
                {active ? <Check size={14} weight="regular" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
