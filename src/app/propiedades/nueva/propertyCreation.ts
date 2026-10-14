export const creationDefaults = {
  name: '', property_type: '', status: 'disponible', address: '', neighborhood: '', subzone: '', city: '', province: '',
  surface_total_m2: '', surface_covered_m2: '', rooms: '', currency: 'USD', price: '', matricula: '', owners: '', gravamenes: '', notes: '',
};
export type CreationDraft = typeof creationDefaults;
export type CreationField = keyof CreationDraft;
export type CreationState = { error: string | null; field: CreationField | null };
export const numericFields = ['surface_total_m2', 'surface_covered_m2', 'rooms', 'price'] as const;
const numericLabels: Record<typeof numericFields[number], string> = {
  surface_total_m2: 'Superficie total', surface_covered_m2: 'Superficie cubierta', rooms: 'Ambientes', price: 'Precio registrado',
};

/** HTML number values use a decimal dot, never a thousands separator.
 * The existing shared action expects es-AR strings; adapt only this form.
 * Preserve zero, empty and exponent forms, without rounding or changing shared consumers.
 */
export function prepareCreationPayload(source: FormData): { data: FormData; state: CreationState } {
  const data = new FormData();
  for (const field of Object.keys(creationDefaults) as CreationField[]) {
    const raw = source.get(field);
    if (raw !== null && typeof raw !== 'string') {
      return { data, state: { error: 'Revisá los datos del formulario antes de guardar.', field } };
    }
    data.set(field, raw ?? '');
  }
  const name = String(data.get('name')).trim();
  if (!name) return { data, state: { error: 'Ingresá un nombre para la propiedad.', field: 'name' } };
  data.set('name', name);
  for (const field of numericFields) {
    const value = String(data.get(field)).trim();
    if (value === '') { data.set(field, ''); continue; }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value))) {
      return { data, state: { error: `Revisá el valor de ${numericLabels[field].toLowerCase()}.`, field } };
    }
    data.set(field, value.replace('.', ','));
  }
  return { data, state: { error: null, field: null } };
}
