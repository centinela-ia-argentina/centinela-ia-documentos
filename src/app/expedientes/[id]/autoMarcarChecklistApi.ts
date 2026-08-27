'use server';

import { autoMarcarChecklist } from '../actions';

export async function autoMarcarChecklistApi(caseId: string) {
  const formData = new FormData();
  formData.append('case_id', caseId);
  return autoMarcarChecklist(formData);
}
