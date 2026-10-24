import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getCaseBasePath, getCaseStatusLabel, getCaseTypeLabel } from '@/lib/industries/caseConfig';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import styles from './CaseDetailHeader.module.css';
export function CaseDetailHeader({title,clientName,status,caseType,industry,administration}:{title:string;clientName:string|null;status:string;caseType:string|null;industry:IndustryType;administration?:ReactNode}) {
  const terms=getIndustryTerms(industry);
  return <>
    <nav className={styles.breadcrumb} aria-label="Ruta de navegación"><Link href={getCaseBasePath(industry)}><ArrowLeft size={16} aria-hidden />{terms.expedientePlural}</Link><CaretRight size={14} aria-hidden /><span>Ficha de {terms.expedienteSingular.toLowerCase()}</span></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>{terms.detalleEyebrow}</p><h1 data-testid="case-detail-title">{title.trim() || terms.itemSinTitulo}</h1><div className={styles.meta}><span className={styles.status}>{getCaseStatusLabel(status,industry)}</span><span>{getCaseTypeLabel(caseType)}</span></div><p className={styles.client}>Cliente: {clientName?.trim() || 'Sin cliente asignado'}</p></div>{administration}</header>
  </>;
}
