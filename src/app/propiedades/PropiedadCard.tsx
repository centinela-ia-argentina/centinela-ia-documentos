import Link from 'next/link';
import { Buildings, HouseLine, Storefront, BuildingOffice, MapTrifold, Garage, Shapes, Question, CheckCircle, ClockCountdown, SealCheck, Key, MinusCircle, MapPin } from '@phosphor-icons/react/dist/ssr';
import { ArrowRight } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import type { PropertyRecord } from '@/types/property';
import styles from './Propiedades.module.css';

const typeIcons = {
  departamento: Buildings, casa: HouseLine, local: Storefront, oficina: BuildingOffice,
  'lote/terreno': MapTrifold, lote: MapTrifold, terreno: MapTrifold, cochera: Garage, otro: Shapes,
};
const statusIcons = {
  disponible: CheckCircle, reservada: ClockCountdown, vendida: SealCheck,
  alquilada: Key, no_disponible: MinusCircle,
};
const stateStyles = {
  disponible: styles.available, reservada: styles.reserved, vendida: styles.sold,
  alquilada: styles.rented, no_disponible: styles.unavailable,
};

export function PropiedadCard({ property }: { property: PropertyRecord }) {
  const type = property.property_type?.toLowerCase() ?? '';
  const status = property.status?.toLowerCase() ?? '';
  const TypeIcon = typeIcons[type as keyof typeof typeIcons] ?? Question;
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] ?? Question;
  const statusStyle = stateStyles[status as keyof typeof stateStyles] ?? styles.undefinedState;
  const name = property.name || 'Propiedad sin nombre';

  return (
    <Surface as={Link} family="interactive" href={`/propiedades/${property.id}`} className={styles.card} aria-label={`Ver ficha: ${name}`}>
      <div className={styles.cardTop}>
        <span className={`${styles.state} ${statusStyle}`}>
          <StatusIcon size={16} weight="duotone" aria-hidden="true" />
          {getPropertyStatusLabel(property.status)}
        </span>
        <span className={styles.type}>{getPropertyTypeLabel(property.property_type)}</span>
      </div>
      <div className={styles.cardHeading}>
        <span className={styles.typeIcon} data-property-type={type || 'undefined'}><TypeIcon size={25} weight="duotone" aria-hidden="true" /></span>
        <h2 className={styles.cardTitle}>{name}</h2>
      </div>
      <p className={styles.address}><MapPin size={16} weight="duotone" aria-hidden="true" /><span>{property.address || 'Dirección no cargada'}</span></p>
      <div className={styles.facts}>
        <div><span className={styles.factLabel}>Precio registrado</span>
          <strong className={property.price == null ? styles.missing : styles.price}>
            {property.price == null ? 'Precio no cargado' : `${property.currency === 'USD' ? 'u$s' : '$'} ${property.price.toLocaleString('es-AR')}`}
          </strong>
        </div>
        <div><span className={styles.factLabel}>Superficie total</span>
          <strong className={property.surface_total_m2 == null ? styles.missing : styles.area}>
            {property.surface_total_m2 == null ? 'Superficie no cargada' : `${property.surface_total_m2} m²`}
          </strong>
        </div>
      </div>
      <div className={styles.cardFoot}><span>Ver ficha</span><ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></div>
    </Surface>
  );
}
