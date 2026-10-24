import { beforeEach, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth:vi.fn(), client:vi.fn(), cleanup:vi.fn(), audit:vi.fn(), revalidate:vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect:(url:string) => { throw Error('REDIRECT:'+url); } }));
vi.mock('next/cache', () => ({ revalidatePath:m.revalidate }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile:m.auth }));
vi.mock('@/lib/supabase/server', () => ({ createClient:m.client }));
vi.mock('@/lib/documents/deleteDocumentSafely', () => ({ deleteDocumentSafely:m.cleanup }));
vi.mock('@/lib/audit/createAuditLog', () => ({ createAuditLog:m.audit }));
import { deleteDocument, deleteDocumentFromCase } from './actions';
function form() { const f=new FormData(); f.set('document_id','d1'); f.set('case_id','c1'); return f; }
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ user:{id:'u1'}, profile:{role:'admin',organization_id:'org1'} });m.client.mockResolvedValue({});m.cleanup.mockResolvedValue({status:'deleted',fileName:'Doc.pdf'});m.audit.mockResolvedValue({ok:true}); });
for (const [label,action,destination] of [['library',deleteDocument,'/documentos?'],['case',deleteDocumentFromCase,'/expedientes/c1?tab=documentos&']] as const) {
  for (const role of ['employee','auditor','client','unknown']) it(`${label}: denies ${role} before cleanup`, async () => {
    m.auth.mockResolvedValue({user:{id:'u1'},profile:{role,organization_id:'org1'}});
    await expect(action(form())).rejects.toThrow('REDIRECT:/acceso-denegado');
    expect(m.cleanup).not.toHaveBeenCalled(); expect(m.client).not.toHaveBeenCalled();
  });
  for (const status of ['failed','partial']) it(`${label}: ${status} never emits success audit`, async () => {
    m.cleanup.mockResolvedValue({status,stage:'storage'});
    await expect(action(form())).rejects.toThrow(`REDIRECT:${destination}docdel=${status}`);
    expect(m.audit).not.toHaveBeenCalled();expect(m.revalidate).toHaveBeenCalledWith('/documentos');
  });
  it(`${label}: success requires checked cleanup and audit`,async()=>{
    await expect(action(form())).rejects.toThrow(`REDIRECT:${destination}docdel=ok`);
    expect(m.cleanup).toHaveBeenCalledWith({}, {documentId:'d1',organizationId:'org1',...(label==='case'?{caseId:'c1'}:{})});
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({action:'document_deleted',resourceId:'d1'}));
  });
  it(`${label}: failed audit is disclosed, not a request to delete again`,async()=>{
    m.audit.mockResolvedValue({ok:false});
    await expect(action(form())).rejects.toThrow(`REDIRECT:${destination}docdel=audit`);
  });
}
it('invalid input is rejected before cleanup',async()=>{await expect(deleteDocumentFromCase(new FormData())).rejects.toThrow('docdel=failed');expect(m.cleanup).not.toHaveBeenCalled();});
it('anonymous request cannot delete',async()=>{m.auth.mockResolvedValue({user:null,profile:null});await expect(deleteDocument(form())).rejects.toThrow('REDIRECT:/login');expect(m.cleanup).not.toHaveBeenCalled();});

// Archive/restore are reversible, but must not audit a failed or zero-row update.
import { archiveDocument, unarchiveDocument } from './actions';
for(const [name,action] of [['archive',archiveDocument],['restore',unarchiveDocument]] as const) {
  for(const failure of ['error','zero','audit','none'])it(`${name}: verifies update before recording result (${failure})`,async()=>{
    const eq=vi.fn();const select=vi.fn().mockResolvedValue({data:failure==='zero'?[]:[{id:'d1'}],error:failure==='error'?{message:'private'}:null});
    const chain={eq,select};eq.mockReturnValue(chain);
    const update=vi.fn().mockReturnValue(chain);m.client.mockResolvedValue({from:()=>({update})});
    if(failure==='audit')m.audit.mockResolvedValue({ok:false});
    if(failure==='none')await action(form());
    else await expect(action(form())).rejects.toThrow(failure==='audit'?'docarchive=audit':'docarchive=failed');
    expect(eq).toHaveBeenCalledWith('organization_id','org1');
    if(failure==='error'||failure==='zero')expect(m.audit).not.toHaveBeenCalled();
    else expect(m.audit).toHaveBeenCalledTimes(1);
  });
}
