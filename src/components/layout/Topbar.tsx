import Link from 'next/link';
import { MagnifyingGlass, Plus, SquaresFour, UploadSimple } from '@phosphor-icons/react/ssr';
import { BackButton } from './BackButton';
import { canUploadDocument, isUserRole } from '@/lib/permissions/roles';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { industryLabels } from '@/lib/industries/documentTypes';
import { getShellContext } from '@/lib/shell/getShellContext';
import styles from './Shell.module.css';

export async function Topbar() {
  const { profile, industry } = await getShellContext();
  const canUpload = isUserRole(profile?.role) && canUploadDocument(profile.role);
  const terms = getIndustryTerms(industry);
  const isRealEstate = industry === 'inmobiliaria';
  return (
    <header className={styles.topbar}>
      <div className={styles.barContent}>
        <div className={styles.scope}><SquaresFour size={14} aria-hidden="true" />
          <span className={styles.scopeText}>Espacio de trabajo · {industryLabels[industry]}</span>
        </div>
        <div className={styles.barActions}>
          <BackButton />
          <Link href="/buscar" className={styles.iconAction} aria-label={`Buscar ${terms.expedienteSingular.toLowerCase()}, documento o cliente`}>
            <MagnifyingGlass size={16} aria-hidden="true" /><span className={styles.actionLabel}>Buscar</span>
          </Link>
          {isRealEstate ? <Link href="/operaciones/nueva" className={styles.iconAction} aria-label="Nueva operación">
            <Plus size={16} aria-hidden="true" /><span className={styles.actionLabel}>Nueva operación</span>
          </Link> : canUpload ? <Link href="/documentos/subir" className={styles.iconAction} aria-label="Subir documento">
            <UploadSimple size={16} aria-hidden="true" /><span className={styles.actionLabel}>Subir documento</span>
          </Link> : null}
        </div>
      </div>
    </header>
  );
}
