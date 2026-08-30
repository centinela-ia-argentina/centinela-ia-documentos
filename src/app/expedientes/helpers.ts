import { type IndustryType, isIndustryType, ACTIVE_INDUSTRY_TYPES } from '@/lib/industries/documentTypes';
import { caseTypesByIndustry } from '@/lib/industries/caseConfig';

export type CaseTypeResolution =
  | {
      ok: true;
      industry: IndustryType;
      caseType: string;
    }
  | {
      ok: false;
      error: 'invalid_industry' | 'invalid_case_type';
    };

export function resolveCaseTypeForIndustry(
  rawIndustry: unknown,
  rawCaseType: unknown
): CaseTypeResolution {
  if (!isIndustryType(rawIndustry)) {
    return { ok: false, error: 'invalid_industry' };
  }
  const industry = rawIndustry as IndustryType;
  
  if (!ACTIVE_INDUSTRY_TYPES.includes(industry)) {
    return { ok: false, error: 'invalid_industry' };
  }

  const exactTypes = caseTypesByIndustry[industry];
  if (!exactTypes || exactTypes.length === 0) {
    return { ok: false, error: 'invalid_industry' };
  }

  const caseType = typeof rawCaseType === 'string' ? rawCaseType.trim() : '';

  if (!caseType) {
    return { ok: false, error: 'invalid_case_type' };
  }

  if (!exactTypes.includes(caseType)) {
    return { ok: false, error: 'invalid_case_type' };
  }

  return { ok: true, industry, caseType };
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
