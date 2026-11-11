import { describe, it, expect } from 'vitest';
import { summarizeChecklistStatuses } from './progress';

describe('summarizeChecklistStatuses — estados desconocidos (OB-T04)', () => {
  it('los estados nulos, vacíos o no reconocidos no cuentan como cumplidos ni pendientes', () => {
    const summary = summarizeChecklistStatuses(['received', '', 'weird', 'pending']);

    expect(summary.total).toBe(4);
    expect(summary.fulfilled).toBe(1);
    expect(summary.missing).toBe(1);
    expect(summary.unknownCount).toBe(2);
    expect(summary.hasUnknown).toBe(true);
    expect(summary.isComplete).toBe(false);
    expect(summary.percent).toBe(25);
  });

  it('isComplete exige cero desconocidos: completo solo con todo recibido/revisado', () => {
    expect(summarizeChecklistStatuses(['received', 'reviewed']).isComplete).toBe(true);
    expect(summarizeChecklistStatuses(['received', 'reviewed', null as unknown as string]).isComplete).toBe(false);
    expect(summarizeChecklistStatuses(['received', 'rejected']).isComplete).toBe(false);
  });

  it('sin aplicables no se declara completo y el avance no se redondea a 100%', () => {
    expect(summarizeChecklistStatuses([]).isComplete).toBe(false);
    expect(summarizeChecklistStatuses([]).percent).toBe(0);
    expect(summarizeChecklistStatuses(['not_required', 'not_required']).total).toBe(0);
  });

  it('con estados desconocidos el porcentaje refleja solo los cumplidos', () => {
    const summary = summarizeChecklistStatuses(['received', 'received', 'unknown-state', '']);
    expect(summary.percent).toBe(50);
    expect(summary.isComplete).toBe(false);
  });
});
