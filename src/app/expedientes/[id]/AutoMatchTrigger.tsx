'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { autoMarcarChecklistApi } from './autoMarcarChecklistApi';

export function AutoMatchTrigger({ caseId, isComplete }: { caseId: string; isComplete: boolean }) {
  const triggered = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!isComplete && !triggered.current) {
      triggered.current = true;
      autoMarcarChecklistApi(caseId).then(() => {
        router.refresh();
      }).catch(console.error);
    }
  }, [caseId, isComplete, router]);

  return null;
}
