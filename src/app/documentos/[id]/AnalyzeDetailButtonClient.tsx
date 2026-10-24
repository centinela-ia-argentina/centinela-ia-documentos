'use client';

import { useTransition } from 'react';
import { MotionButton } from '@/components/ui/MotionButton';
import { analyzeDocument } from '../actions';

export function AnalyzeDetailButtonClient({ documentId, label }: { documentId: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  const handleAnalyze = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('document_id', documentId);
      await analyzeDocument(formData);
    });
  };

  return (
    <MotionButton
      onClick={handleAnalyze}
      disabled={isPending}
      className={`w-full px-5 py-3 text-sm ${isPending ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Analizando...
        </span>
      ) : (
        label
      )}
    </MotionButton>
  );
}
