'use client';
import { useFormStatus } from 'react-dom';
import { AppButton } from '@/components/ui/AppButton';

/** Same pending labels/disabled contract as FormSubmitButton, scoped to V3 records. */
export function RecordPendingButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return <AppButton type="submit" disabled={pending} aria-busy={pending}>{pending ? loadingLabel : label}</AppButton>;
}
