import { describe, it, expect } from 'vitest';
import {
  buildObservacionesModel,
  getStaleDays,
  staleCategory,
  CLIENT_STALE_DAYS,
  PROPERTY_STALE_DAYS,
  type ObservacionesSources,
} from './data';

const NOW = new Date('2026-11-10T12:00:00.000Z');

const doc = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  file_name: `${id}.pdf`,
  document_type: null,
  sensitivity_level: 'low',
  expires_at: null,
  case_id: null,
  file_mime_type: 'application/pdf',
  ...extra,
});

const baseSources = (overrides: Partial<ObservacionesSources> = {}): ObservacionesSources => ({
  documents: [],
  aiOutputs: [],
  cases: [],
  checklistItems: [],
  clients: [],
  properties: [],
  agendaPlazos: [],
  industry: 'inmobiliaria',
  ...overrides,
});

describe('getStaleDays — antigüedad en períodos de 24 horas (OB-T03)', () => {
  it('cuenta períodos completos de 24h', () => {
    expect(getStaleDays('2026-11-09T12:00:00.000Z', NOW)).toBe(1);
    expect(getStaleDays('2026-11-09T12:00:01.000Z', NOW)).toBe(0);
  });

  it('fecha futura, ausente o inválida no es antigüedad', () => {
    expect(getStaleDays('2026-11-11T00:00:00.000Z', NOW)).toBeNull();
    expect(getStaleDays(null, NOW)).toBeNull();
    expect(getStaleDays('no-es-fecha', NOW)).toBeNull();
  });

  it('límite exacto de 15 días completos', () => {
    expect(getStaleDays('2026-10-26T12:00:00.000Z', NOW)).toBe(15);
  });
});

describe('staleCategory — conteo parcial e indeterminadas', () => {
  it('cuenta solo las que superan el umbral; indeterminadas se señalan', () => {
    const result = staleCategory(
      [
        { id: 'a', name: 'A', updated_at: '2026-10-01T00:00:00.000Z' },
        { id: 'b', name: 'B', updated_at: '2026-11-09T00:00:00.000Z' },
        { id: 'c', name: 'C', updated_at: null },
        { id: 'd', name: 'D', updated_at: 'futura-invalidez' },
      ],
      CLIENT_STALE_DAYS,
      NOW
    );

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('a');
    expect(result.hasIndeterminate).toBe(true);
  });

  it('sin indeterminadas no hay aviso parcial', () => {
    const result = staleCategory(
      [{ id: 'a', name: 'A', updated_at: '2026-10-01T00:00:00.000Z' }],
      PROPERTY_STALE_DAYS,
      NOW
    );
    expect(result.hasIndeterminate).toBe(false);
  });
});

describe('buildObservacionesModel — estados de consulta (OB-T01)', () => {
  it('consulta fallida de documentos → categorías dependientes desconocidas, no cero', () => {
    const model = buildObservacionesModel(baseSources({ documents: null }), NOW);

    expect(model.sensibles.kind).toBe('unknown');
    expect(model.vencimientos.kind).toBe('unknown');
    expect(model.iaPendientes.kind).toBe('unknown');
    expect(model.queriesComplete).toBe(false);
    expect(model.totalObservaciones).toBeNull();
    expect(model.failedDependencies).toContain('documentos');
  });

  it('fallo de checklist no invalida categorías independientes de documentos', () => {
    const model = buildObservacionesModel(
      baseSources({
        documents: [doc('d1', { sensitivity_level: 'high' })],
        checklistItems: null,
      }),
      NOW
    );

    expect(model.sensibles.kind).toBe('ok');
    if (model.sensibles.kind === 'ok') expect(model.sensibles.total).toBe(1);
    expect(model.incompletos.kind).toBe('unknown');
    expect(model.failedDependencies).toContain('checklist');
  });

  it('rubro no inmobiliario: fallo de clientes/propiedades no bloquea el total', () => {
    const model = buildObservacionesModel(baseSources({ industry: 'legal', clients: null, properties: null }), NOW);

    expect(model.clientesSinSeguimiento.kind).toBe('ok');
    if (model.clientesSinSeguimiento.kind === 'ok') expect(model.clientesSinSeguimiento.total).toBe(0);
    expect(model.queriesComplete).toBe(true);
  });

  it('rubro inmobiliario: fallo de clientes marca dependencia y evita el total', () => {
    const model = buildObservacionesModel(baseSources({ clients: null }), NOW);

    expect(model.clientesSinSeguimiento.kind).toBe('unknown');
    expect(model.queriesComplete).toBe(false);
    expect(model.failedDependencies).toContain('clientes');
  });

  it('todo consultado y todo en cero → total 0 y queriesComplete', () => {
    const model = buildObservacionesModel(baseSources(), NOW);
    expect(model.queriesComplete).toBe(true);
    expect(model.totalObservaciones).toBe(0);
  });

  it('categorías se calculan sobre datos disponibles: sensibles y sin clasificar', () => {
    const model = buildObservacionesModel(
      baseSources({
        documents: [
          doc('d1', { sensitivity_level: 'critical' }),
          doc('d2', { document_type: 'Contrato' }),
        ],
      }),
      NOW
    );

    if (model.sensibles.kind === 'ok') expect(model.sensibles.total).toBe(1);
    if (model.sinClasificar.kind === 'ok') expect(model.sinClasificar.total).toBe(1); // d2 tiene tipo, d1 no
    if (model.iaPendientes.kind === 'ok') expect(model.iaPendientes.total).toBe(2);
  });
});

describe('buildObservacionesModel — vencimientos y plazos', () => {
  it('vencidos y por vencer se ordenan por proximidad', () => {
    const model = buildObservacionesModel(
      baseSources({
        documents: [
          doc('vencido', { expires_at: '2026-11-01' }),
          doc('proximo', { expires_at: '2026-11-25' }),
          doc('vigente', { expires_at: '2027-06-01' }),
        ],
      }),
      NOW
    );

    expect(model.vencimientos.kind).toBe('ok');
    if (model.vencimientos.kind !== 'ok') return;
    expect(model.vencimientos.total).toBe(2);
    expect(model.vencimientos.kind === 'ok' && model.vencimientos.items[0].id).toBe('vencido');
  });

  it('reservas por vencer solo para inmobiliaria y con metadata de reserva', () => {
    const reservaCase = {
      id: 'c1',
      title: 'Reserva 1',
      status: 'active',
      metadata: { fecha_fin_reserva: '2026-11-20' },
    };

    const inmobiliaria = buildObservacionesModel(baseSources({ cases: [reservaCase] }), NOW);
    expect(inmobiliaria.reservasPorVencer.kind).toBe('ok');
    if (inmobiliaria.reservasPorVencer.kind === 'ok') expect(inmobiliaria.reservasPorVencer.total).toBe(1);

    const legal = buildObservacionesModel(baseSources({ industry: 'legal', cases: [reservaCase] }), NOW);
    expect(legal.reservasPorVencer.kind).toBe('ok');
    if (legal.reservasPorVencer.kind === 'ok') expect(legal.reservasPorVencer.total).toBe(0);
  });
});

describe('buildObservacionesModel — incompletos con estados desconocidos (OB-T04)', () => {
  const item = (caseId: string, status: string) => ({
    status,
    checklists: { case_id: caseId },
  });

  it('un caso con estados desconocidos figura como incompleto con aviso, no como completo', () => {
    const model = buildObservacionesModel(
      baseSources({
        cases: [{ id: 'c1', title: 'Caso 1', status: 'active', metadata: null }],
        checklistItems: [item('c1', 'received'), item('c1', 'estado-raro')],
      }),
      NOW
    );

    expect(model.incompletos.kind).toBe('ok');
    expect(model.incompletos.kind === 'ok' && model.incompletos.total).toBe(1);
    expect(model.incompletos.kind === 'ok' && model.incompletos.items[0].hasUnknown).toBe(true);
  });

  it('casos archivados no generan observaciones', () => {
    const model = buildObservacionesModel(
      baseSources({
        cases: [{ id: 'c1', title: 'Archivado', status: 'archived', metadata: null }],
        checklistItems: [item('c1', 'pending')],
      }),
      NOW
    );

    expect(model.incompletos.kind === 'ok' && model.incompletos.total).toBe(0);
  });
});
