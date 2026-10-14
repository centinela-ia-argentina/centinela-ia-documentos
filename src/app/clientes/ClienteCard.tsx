import Link from 'next/link';
import { CheckCircle, ClockCountdown, SealCheck, XCircle, UserCircle, HouseLine, Key, MapPinArea, Phone, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { ArrowRight } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { getClientStatusLabel, getClientTypeLabel, getOperationInterestLabel, getDesiredPropertyTypeLabel } from '@/lib/clients/labels';
import type { ClientRecord } from '@/types/client';
import styles from './Clientes.module.css';

const statusIcons = { activo: CheckCircle, en_seguimiento: ClockCountdown, cerrado: SealCheck, descartado: XCircle };

function budgetLabel(amount: number | null, currency: string | null) {
  if (amount == null || !Number.isFinite(amount)) return 'Sin definir';
  const value = amount.toLocaleString('es-AR');
  if (currency === 'USD') return `u$s ${value}`;
  if (currency === 'ARS') return `$ ${value}`;
  return currency ? `${currency} ${value}` : `${value} · moneda sin definir`;
}

export function ClienteCard({ client }: { client: ClientRecord }) {
  const name = client.name || 'Cliente sin nombre';
  const status = client.status?.toLowerCase() ?? '';
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] ?? UserCircle;
  const statusStyle = status === 'activo' ? styles.active : status === 'en_seguimiento' ? styles.follow : styles.neutral;
  const hasCriteria = Boolean(client.operation_interest || client.desired_property_type || client.zone);
  const criteriaTitle = [
    client.operation_interest ? getOperationInterestLabel(client.operation_interest) : null,
    client.desired_property_type ? getDesiredPropertyTypeLabel(client.desired_property_type) : null,
  ].filter(Boolean).join(' · ');
  const CriteriaIcon = client.operation_interest === 'alquiler' ? Key : HouseLine;
  const rooms = client.min_rooms;
  const roomsLabel = rooms == null || !Number.isFinite(rooms) ? 'Sin definir' : rooms === 0 ? '0 (registrado)' : `${rooms}+ ambientes`;

  return (
    <Surface as={Link} family="interactive" href={`/clientes/${client.id}`} className={styles.card} aria-label={`Ver ficha: ${name}`}>
      <div className={styles.cardTop}>
        <div className={styles.identity}><h2>{name}</h2><span className={styles.type}>{getClientTypeLabel(client.client_type)}</span></div>
        <span className={`${styles.badge} ${statusStyle}`}><StatusIcon size={16} weight="duotone" aria-hidden="true" />{getClientStatusLabel(client.status)}</span>
      </div>
      <div className={styles.criteria}>
        {hasCriteria ? <>
          {criteriaTitle && <div className={styles.criteriaTitle}><CriteriaIcon size={20} weight="duotone" aria-hidden="true" /><span>{criteriaTitle}</span></div>}
          <div className={styles.location}><MapPinArea size={18} weight="duotone" aria-hidden="true" /><span>{client.zone || 'Zona sin definir'}</span></div>
        </> : <p className={styles.quiet}>Sin criterios de búsqueda específicos</p>}
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>Presupuesto máximo</span><strong>{budgetLabel(client.budget_max, client.currency)}</strong></div>
        <div className={styles.metric}><span>Ambientes mín.</span><strong>{roomsLabel}</strong></div>
      </div>
      <div className={styles.contact}>
        {client.phone && <div className={styles.contactLine}><Phone size={18} weight="duotone" aria-hidden="true" /><span>{client.phone}</span></div>}
        {client.email && <div className={styles.contactLine}><EnvelopeSimple size={18} weight="duotone" aria-hidden="true" /><span>{client.email}</span></div>}
        {!client.phone && !client.email && <p className={styles.quiet}>Sin contacto registrado</p>}
      </div>
      <div className={styles.cardFoot}><span>Ver ficha</span><ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></div>
    </Surface>
  );
}
