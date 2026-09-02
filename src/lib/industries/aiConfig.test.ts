import { describe, expect, it } from 'vitest';
import {
  getAnalysisSystemPrompt,
  getRagSystemPrompt,
} from './aiConfig';
import { ACTIVE_INDUSTRY_TYPES } from './documentTypes';

describe('active commercial industries', () => {
  it('keeps only the three audited and selectable verticals active', () => {
    expect(ACTIVE_INDUSTRY_TYPES).toEqual([
      'legal',
      'escribania',
      'inmobiliaria',
    ]);
  });
});

describe('AI prompt routing', () => {
  it('routes every active vertical to its own analysis and RAG persona', () => {
    expect(getAnalysisSystemPrompt('legal')).toContain('asistente jurídico argentino');
    expect(getRagSystemPrompt('legal')).toContain('asistente jurídico');

    expect(getAnalysisSystemPrompt('escribania')).toContain('asistente notarial argentino');
    expect(getRagSystemPrompt('escribania')).toContain('asistente notarial experto');

    expect(getAnalysisSystemPrompt('inmobiliaria')).toContain('asistente inmobiliario argentino');
    expect(getRagSystemPrompt('inmobiliaria')).toContain('asistente inmobiliario experto');
  });

  it.each(['general', 'empresa'] as const)(
    'fails closed instead of using the legal prompt for %s',
    (industry) => {
      expect(() => getAnalysisSystemPrompt(industry)).toThrow(
        'Unsupported industry for document analysis'
      );
      expect(() => getRagSystemPrompt(industry)).toThrow(
        'Unsupported industry for RAG'
      );
    }
  );
});
