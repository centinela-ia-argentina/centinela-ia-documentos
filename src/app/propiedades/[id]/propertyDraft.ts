import type { PropertyRecord } from '@/types/property';
import type { PropertyExtraction } from '@/lib/ai/extraerPropiedad';

export const propertyTypes = ['', 'casa', 'departamento', 'lote/terreno', 'local', 'oficina', 'cochera', 'otro'];
export const draftFields = ['name', 'property_type', 'status', 'address', 'neighborhood', 'subzone', 'city', 'province', 'surface_total_m2', 'surface_covered_m2', 'rooms', 'currency', 'price', 'matricula', 'owners', 'gravamenes', 'notes'] as const;
export type PropertyDraft = Record<(typeof draftFields)[number], string>;
export function createPropertyDraft(record: PropertyRecord): PropertyDraft {
  return Object.fromEntries(draftFields.map(key => [key, String(record[key] ?? (key === 'currency' ? 'USD' : key === 'status' ? 'disponible' : ''))])) as PropertyDraft;
}
const extractionMap = {
  direccion: 'address', tipo_propiedad: 'property_type', matricula: 'matricula',
  superficie_total_m2: 'surface_total_m2', superficie_cubierta_m2: 'surface_covered_m2',
  ambientes: 'rooms', titulares: 'owners', gravamenes: 'gravamenes', observaciones: 'notes',
} as const;
/** Only present suggestions are copied. This helper never persists or normalizes a backend enum. */
export function applyExtractionToDraft(draft: PropertyDraft, extraction: PropertyExtraction) {
  const next = { ...draft };
  const skipped: string[] = [];
  for (const [source, target] of Object.entries(extractionMap)) {
    const value = extraction[source as keyof PropertyExtraction];
    if (value == null || value === '') continue;
    if (target === 'property_type' && !propertyTypes.includes(String(value))) {
      skipped.push(String(value));
      continue;
    }
    next[target] = String(value);
  }
  return { draft: next, skipped };
}
