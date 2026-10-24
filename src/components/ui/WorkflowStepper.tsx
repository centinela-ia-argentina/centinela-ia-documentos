'use client';
import { Check } from '@phosphor-icons/react';
import styles from './SharedControls.module.css';

export type WorkflowStep = { id: number; label: string; helper: string };
export function WorkflowStepper({ steps, step, onStepChange }: {
  steps: WorkflowStep[]; step: number; onStepChange: (step: number) => void;
}) {
  return <ol className={styles.steps} aria-label="Progreso de creación">
    {steps.map((item) => <li key={item.id}>
      <button type="button" onClick={() => onStepChange(item.id)} aria-current={step === item.id ? 'step' : undefined} className={styles.step}>
        <span className={`${styles.stepNumber}${step > item.id ? ` ${styles.stepComplete}` : ''}`}>
          {step > item.id ? <Check size={15} aria-hidden="true" /> : item.id}
        </span>
        <span><span className={`font-display ${styles.stepLabel}`}>{item.label}</span><span className={`font-ui ${styles.stepHelp}`}>{item.helper}</span></span>
      </button>
    </li>)}
  </ol>;
}
