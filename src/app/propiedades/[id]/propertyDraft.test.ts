import { describe, expect, it } from 'vitest';
import { createPropertyDraft, applyExtractionToDraft, draftFields } from './propertyDraft';
import type { PropertyRecord } from '@/types/property';
import type { PropertyExtraction } from '@/lib/ai/extraerPropiedad';
const record = { name:'Fixture',status:'disponible',property_type:'casa',currency:'ARS',surface_total_m2:0,rooms:0,owners:'Existing',address:'Existing address',notes:'Existing note' } as PropertyRecord;
const extraction = {direccion:null,tipo_propiedad:null,matricula:null,superficie_total_m2:null,superficie_cubierta_m2:null,ambientes:null,titulares:null,gravamenes:null,observaciones:null} as PropertyExtraction;
describe('property draft: approved review-before-save flow',()=>{
 it('contains the same 17 editable fields and handles zero/defaults',()=>{const draft=createPropertyDraft(record);expect(Object.keys(draft)).toEqual([...draftFields]);expect(draftFields).toHaveLength(17);expect(draft.surface_total_m2).toBe('0');expect(draft.rooms).toBe('0');expect(draft.currency).toBe('ARS');expect(draft.price).toBe('');});
 it('does not modify its input or replace missing/empty suggestions',()=>{const draft=createPropertyDraft(record);const result=applyExtractionToDraft(draft,{...extraction,direccion:'',titulares:null});expect(result.draft).toEqual(draft);expect(result.draft).not.toBe(draft);expect(result.skipped).toEqual([]);});
 it('applies all nine present mapped values and preserves unrelated changes',()=>{const draft={...createPropertyDraft(record),name:'User draft',price:'150',neighborhood:'User zone'};const result=applyExtractionToDraft(draft,{direccion:'New address',tipo_propiedad:'departamento',matricula:'M1',superficie_total_m2:0,superficie_cubierta_m2:0,ambientes:0,titulares:'New owner',gravamenes:'G1',observaciones:'New note'});expect(result.draft).toMatchObject({name:'User draft',price:'150',neighborhood:'User zone',address:'New address',property_type:'departamento',matricula:'M1',surface_total_m2:'0',surface_covered_m2:'0',rooms:'0',owners:'New owner',gravamenes:'G1',notes:'New note'});expect(draft.address).toBe('Existing address');});
 it('does not silently normalize incompatible lote enum',()=>{const result=applyExtractionToDraft(createPropertyDraft(record),{...extraction,tipo_propiedad:'lote'});expect(result.draft.property_type).toBe('casa');expect(result.skipped).toEqual(['lote']);});
 it('preserves unrecognized stored values when initializing',()=>{expect(createPropertyDraft({...record,property_type:'legacy',status:'legacy-status',currency:'EUR'}).property_type).toBe('legacy');});
});
