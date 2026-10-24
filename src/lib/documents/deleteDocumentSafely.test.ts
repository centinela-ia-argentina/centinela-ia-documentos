import { describe, it, expect } from 'vitest';
import { deleteDocumentSafely } from './deleteDocumentSafely';

type Client = Parameters<typeof deleteDocumentSafely>[0];
type Step = 'lookup' | 'storage' | 'chunks' | 'analysis' | 'checklist' | 'document';
function fixture(fail?: Step, options: { throws?: boolean; missing?: boolean; zeroRows?: boolean } = {}) {
  const calls: { step: Step; filters: [string, unknown][]; update?: unknown }[] = [];
  function result(step: Step) {
    if (fail === step && options.throws) throw Error('private storage-path provider-message');
    return { error: fail === step ? { message: 'private provider error' } : null,
      data: step === 'lookup' ? options.missing ? null : { id: 'd1', file_name: 'Doc.pdf', file_path: 'private/path' }
        : step === 'document' ? options.zeroRows ? [] : [{ id: 'd1' }] : null };
  }
  const client = {
    from(table: string) {
      const step: Step = table === 'documents' ? 'lookup' : table === 'document_chunks' ? 'chunks' : table === 'ai_outputs' ? 'analysis' : 'checklist';
      const call: (typeof calls)[number] = { step, filters: [] }; calls.push(call);
      const chain = {
        select() { return chain; },
        delete() { if (table === 'documents') call.step = 'document'; return chain; },
        update(value: unknown) { call.update = value; return chain; },
        eq(key: string, value: unknown) { call.filters.push([key, value]); return chain; },
        maybeSingle: async () => result(call.step),
        then(resolve: (value: ReturnType<typeof result>) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve().then(() => result(call.step)).then(resolve, reject);
        },
      };
      return chain;
    },
    storage: { from: () => ({ remove: async () => { calls.push({ step: 'storage', filters: [] }); return result('storage'); } }) },
  } as unknown as Client;
  return { client, calls };
}
const input = { documentId: 'd1', organizationId: 'org1', caseId: 'c1' };
describe('checked document cleanup', () => {
  it('completes every stage in order with tenant and case constraints', async () => {
    const f = fixture();
    expect(await deleteDocumentSafely(f.client, input)).toEqual({ status: 'deleted', fileName: 'Doc.pdf' });
    expect(f.calls.map(c => c.step)).toEqual(['lookup','storage','chunks','analysis','checklist','document']);
    for (const c of f.calls.filter(c => c.step !== 'storage')) expect(c.filters).toContainEqual(['organization_id','org1']);
    for (const c of f.calls.filter(c => c.step === 'lookup' || c.step === 'document')) expect(c.filters).toContainEqual(['case_id','c1']);
    expect(f.calls.find(c => c.step === 'checklist')?.update).toEqual({ document_id: null, status: 'pending', match_source: null });
  });
  for (const throws of [false, true]) for (const step of ['lookup','storage','chunks','analysis','checklist','document'] as const) {
    it(`stops at ${step}, throws=${throws}, never claims success`, async () => {
      const f = fixture(step, { throws });
      expect(await deleteDocumentSafely(f.client, input)).toEqual({ status: step === 'lookup' ? 'failed' : 'partial', stage: step });
      const stages = ['lookup','storage','chunks','analysis','checklist','document'];
      expect(f.calls.map(c => c.step)).toEqual(stages.slice(0, stages.indexOf(step)+1));
    });
  }
  it('missing or tenant/case-invisible document never touches storage', async () => {
    const f = fixture(undefined, { missing: true });
    expect(await deleteDocumentSafely(f.client, input)).toEqual({ status: 'failed', stage: 'lookup' });
    expect(f.calls.map(c => c.step)).toEqual(['lookup']);
  });
  it('zero rows deleted is not success', async () => {
    const f = fixture(undefined, { zeroRows: true });
    expect(await deleteDocumentSafely(f.client, input)).toEqual({ status: 'partial', stage: 'document' });
  });
  it('library entry point remains tenant-scoped without inventing a case', async () => {
    const f = fixture(); await deleteDocumentSafely(f.client, { documentId:'d1', organizationId:'org1' });
    expect(f.calls.flatMap(c => c.filters).some(([key]) => key === 'case_id')).toBe(false);
  });
});
