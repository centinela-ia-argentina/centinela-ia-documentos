import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import { normalizeZone } from '@/lib/location/normalizeZone';

export type CriterioMatch = { 
  key: 'tipo' | 'presupuesto' | 'ambientes' | 'zona'; 
  label: string; 
  aplica: boolean; 
  cumple: boolean;
};

export type ResultadoMatch = { 
  elegible: boolean; 
  coincidencias: number; 
  aplicables: number; 
  ratio: number; 
  criterios: CriterioMatch[];
};

export function evaluarMatch(client: ClientRecord, property: PropertyRecord): ResultadoMatch {
  // Solo participan del match las propiedades disponibles
  const elegible = property.status === 'disponible';
  
  const criterios: CriterioMatch[] = [];

  // Criterio: Tipo
  const aplicaTipo = !!client.desired_property_type && client.desired_property_type !== 'cualquiera';
  const cumpleTipo = aplicaTipo && property.property_type === client.desired_property_type;
  criterios.push({ key: 'tipo', label: 'Tipo', aplica: aplicaTipo, cumple: cumpleTipo });

  // Criterio: Presupuesto
  const aplicaPresupuesto = client.budget_min != null || client.budget_max != null;
  const cumplePresupuesto = aplicaPresupuesto && 
    property.price != null && 
    property.currency === client.currency &&
    (client.budget_min == null || property.price >= client.budget_min) &&
    (client.budget_max == null || property.price <= client.budget_max);
  criterios.push({ key: 'presupuesto', label: 'Presupuesto', aplica: aplicaPresupuesto, cumple: cumplePresupuesto });

  // Criterio: Ambientes
  const aplicaAmbientes = client.min_rooms != null;
  const cumpleAmbientes = aplicaAmbientes && property.rooms != null && property.rooms >= client.min_rooms!;
  criterios.push({ key: 'ambientes', label: 'Ambientes', aplica: aplicaAmbientes, cumple: cumpleAmbientes });

  // Criterio: Zona
  // La zona del cliente puede venir en desired_neighborhood, desired_city, o el viejo zone.
  const desiredNeigh = client.desired_neighborhood?.trim() || client.zone?.trim();
  const desiredCity = client.desired_city?.trim();
  const aplicaZona = !!desiredNeigh || !!desiredCity;
  
  let cumpleZona = false;
  if (aplicaZona) {
    if (desiredNeigh) {
      const normDesiredNeigh = normalizeZone(desiredNeigh);
      if (property.neighborhood && normalizeZone(property.neighborhood).includes(normDesiredNeigh)) {
        cumpleZona = true;
      } else if (property.address && normalizeZone(property.address).includes(normDesiredNeigh)) {
        cumpleZona = true;
      }
    }
    
    if (!cumpleZona && desiredCity) {
      const normDesiredCity = normalizeZone(desiredCity);
      if (property.city && normalizeZone(property.city).includes(normDesiredCity)) {
        cumpleZona = true;
      } else if (property.address && normalizeZone(property.address).includes(normDesiredCity)) {
        cumpleZona = true;
      }
    }
  }

  criterios.push({ key: 'zona', label: 'Zona', aplica: aplicaZona, cumple: cumpleZona });

  const coincidencias = criterios.filter(c => c.aplica && c.cumple).length;
  const aplicables = criterios.filter(c => c.aplica).length;
  const ratio = aplicables > 0 ? coincidencias / aplicables : 0;

  return { elegible, coincidencias, aplicables, ratio, criterios };
}

export function ordenarPorMatch<T>(items: { item: T; match: ResultadoMatch }[]) {
  return items.sort((a, b) => {
    // Primero por coincidencias (descendente)
    if (a.match.coincidencias !== b.match.coincidencias) {
      return b.match.coincidencias - a.match.coincidencias;
    }
    // Luego por ratio (descendente)
    return b.match.ratio - a.match.ratio;
  });
}
