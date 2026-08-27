'use client';

import { useEffect, useRef } from 'react';
import { autoMarcarChecklistApi } from './autoMarcarChecklistApi';

export function AutoMatchTrigger({ caseId, isComplete }: { caseId: string; isComplete: boolean }) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!isComplete && !triggered.current) {
      triggered.current = true;
      autoMarcarChecklistApi(caseId).catch(console.error);
    }
  }, [caseId, isComplete]);

  return null;
}
