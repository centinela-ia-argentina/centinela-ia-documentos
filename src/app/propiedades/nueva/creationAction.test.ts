import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw Object.assign(new Error(`redirect:${path}`), { digest: 'NEXT_REDIRECT' }); }), unstable_rethrow: vi.fn((error: { digest?: string }) => { if (error?.digest) throw error; }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/audit/createAuditLog', () => ({ createAuditLog: vi.fn() }));
vi.mock('@/lib/ai/extraerPropiedad', () => ({ extraerDatosPropiedadDeArchivo: vi.fn() }));
vi.mock('@/lib/ai/generarAviso', () => ({ generarAvisoPropiedad: vi.fn() }));
vi.mock('@/lib/ai/tasador', () => ({ tasarPropiedadIA: vi.fn() }));
vi.mock('@/lib/ai/analizarMatch', () => ({ analizarMatchConIA: vi.fn() }));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { revalidatePath } from 'next/cache';
import { createNewProperty } from './creationAction';
import { creationDefaults } from './propertyCreation';
const previous = { error: null, field: null };
const inserted: Record<string, unknown>[] = [];
let reply: { data: unknown; error: unknown };
function source(values: Record<string, string> = {}) { const data = new FormData(); for (const [key, value] of Object.entries({ ...creationDefaults, name: 'Fixture', ...values })) data.set(key, value); return data; }
function auth(role = 'admin') { vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role, organization_id: 'fixture-org' } } as never); }
beforeEach(() => {
  vi.clearAllMocks(); inserted.length = 0; auth(); reply = { data: { id: 'fixture-new-id' }, error: null };
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden'); }));
  vi.mocked(createAuditLog).mockResolvedValue({ ok: true });
  vi.mocked(createClient).mockResolvedValue({ from: vi.fn((table: string) => {
    expect(table).toBe('properties'); const q = { insert: vi.fn((rows: Record<string, unknown>[]) => { inserted.push(...rows); return q; }), select: vi.fn(() => q), single: vi.fn(async () => reply) }; return q;
  }) } as never);
});
afterEach(() => vi.unstubAllGlobals());
describe('new UI delegates to unchanged createProperty server contract with synthetic DB', () => {
  it.each(['admin', 'employee'])('keeps organization/audit/list redirect for %s and exact decimal values', async role => {
    auth(role); await expect(createNewProperty(previous, source({ surface_total_m2: '82.50', surface_covered_m2: '0.50', price: '185000.25', rooms: '0', organization_id: 'attacker', created_by: 'attacker', publication_status: 'publicada' }))).rejects.toThrow('redirect:/propiedades');
    expect(inserted).toHaveLength(1); expect(inserted[0]).toMatchObject({ name: 'Fixture', organization_id: 'fixture-org', created_by: 'fixture-user', surface_total_m2: 82.5, surface_covered_m2: 0.5, price: 185000.25, rooms: 0, publication_status: 'no_publicada', currency: 'USD', status: 'disponible' });
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'property_created', resourceId: 'fixture-new-id', organizationId: 'fixture-org', userId: 'fixture-user' })); expect(revalidatePath).toHaveBeenCalledWith('/propiedades'); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps missing numbers null rather than default zero', async () => { await expect(createNewProperty(previous, source())).rejects.toThrow('redirect:/propiedades'); for (const key of ['surface_total_m2', 'surface_covered_m2', 'price', 'rooms']) expect(inserted[0][key]).toBeNull(); });
  it('supports scientific notation accepted by browser number controls without magnification', async () => { await expect(createNewProperty(previous, source({ price: '1.25e3' }))).rejects.toThrow('redirect:/propiedades'); expect(inserted[0].price).toBe(1250); });
  it('does not call database on invalid number or name', async () => { expect((await createNewProperty(previous, source({ price: 'NaN' }))).field).toBe('price'); expect((await createNewProperty(previous, source({ name: '  ' }))).field).toBe('name'); expect(createClient).not.toHaveBeenCalled(); });
  it.each(['client', 'auditor', 'unknown'])('retains direct server role guard for %s before validation', async role => { auth(role); await expect(createNewProperty(previous, source({ name: '' }))).rejects.toThrow('redirect:/acceso-denegado?motivo=rol&accion=crear'); expect(createClient).not.toHaveBeenCalled(); });
  it('keeps login redirect', async () => { vi.mocked(getUserProfile).mockResolvedValue({ user: null, profile: null }); await expect(createNewProperty(previous, source())).rejects.toThrow('redirect:/login'); expect(createClient).not.toHaveBeenCalled(); });
  it('keeps onboarding redirect', async () => { vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture' }, profile: null } as never); await expect(createNewProperty(previous, source())).rejects.toThrow('redirect:/onboarding'); });
  it('returns safe uncertain insertion error with no audit/redirect', async () => { reply = { data: null, error: { code: 'XX', message: 'private provider detail' } }; const result = await createNewProperty(previous, source()); expect(result.error).toContain('Tus datos se conservan'); expect(result.error).not.toContain('private'); expect(createAuditLog).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled(); });
  it('warns against blind retry on possible post-insert audit failure', async () => { vi.mocked(createAuditLog).mockRejectedValue(new Error('secret audit info')); const result = await createNewProperty(previous, source()); expect(inserted).toHaveLength(1); expect(result.error).toContain('evitar duplicados'); expect(result.error).not.toContain('secret'); });
});
