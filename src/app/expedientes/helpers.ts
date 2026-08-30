import { type IndustryType, isIndustryType } from '@/lib/industries/documentTypes';
import { getCaseTypes } from '@/lib/industries/caseConfig';

export function resolveCaseTypeForIndustry(
  rawIndustry: unknown,
  rawCaseType: unknown
): { industry: IndustryType; caseType: string; error?: 'invalid_industry' | 'invalid_case_type' } {
  if (!isIndustryType(rawIndustry)) {
    return { industry: 'general', caseType: '', error: 'invalid_industry' };
  }
  const industry = rawIndustry as IndustryType;
  const caseType = typeof rawCaseType === 'string' ? rawCaseType.trim() : '';

  if (!caseType) {
    return { industry, caseType, error: 'invalid_case_type' };
  }

  const validTypes = getCaseTypes(industry);
  if (!validTypes.includes(caseType)) {
    return { industry, caseType, error: 'invalid_case_type' };
  }

  return { industry, caseType };
}

export function getChecklistItemsToInsert(templateTitles: string[], currentTitles: string[]): string[] {
  const currentSet = new Set(currentTitles);
  return templateTitles.filter(t => !currentSet.has(t));
}

export function getNextChecklistStatus(currentStatus: string): string {
  switch (currentStatus) {
    case 'pending': return 'received';
    case 'received': return 'reviewed';
    case 'reviewed': return 'pending';
    default: return 'pending';
  }
}
