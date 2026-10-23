import { CheckCircle, FolderPlus, FileArrowUp, UserPlus, ArrowRight } from '@phosphor-icons/react/ssr';
import { AppButtonLink } from '@/components/ui/AppButton';
import styles from './Dashboard.module.css';

import { IndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';

type PrimerosPasosProps = {
  hasCase: boolean;
  hasDocument: boolean;
  hasTeam: boolean;
  isAdmin: boolean;
  userName?: string | null;
  industry?: IndustryType;
};

type Step = {
  done: boolean;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof FolderPlus;
};

export function PrimerosPasos({
  hasCase,
  hasDocument,
  hasTeam,
  isAdmin,
  userName,
  industry = 'general',
}: PrimerosPasosProps) {
  const terms = getIndustryTerms(industry);
  const orgDescriptor =
    industry === 'inmobiliaria'
      ? 'tu inmobiliaria'
      : industry === 'escribania'
      ? 'tu escribanía'
      : 'tu estudio';

  const casePath = industry === 'inmobiliaria' ? '/operaciones/nueva' : '/expedientes/nuevo';

  const steps: Step[] = [
    {
      done: hasCase,
      title: `Creá ${terms.unExpediente}`,
      description: `Organizá tu trabajo por ${terms.expedienteSingular.toLowerCase()}: datos, documentos y plazos en un solo lugar.`,
      href: casePath,
      cta: terms.nuevoCta,
      icon: FolderPlus,
    },
    {
      done: hasDocument,
      title: 'Subí tu primer documento',
      description: `Cargá un archivo a la bóveda y asignalo a ${terms.unExpediente}.`,
      href: '/documentos',
      cta: 'Ir a Documentos',
      icon: FileArrowUp,
    },
  ];

  if (isAdmin) {
    steps.push({
      done: hasTeam,
      title: 'Invitá a tu equipo',
      description: 'Sumá colaboradores con su rol (operador, auditor o cliente).',
      href: '/usuarios/invitaciones',
      cta: 'Invitar equipo',
      icon: UserPlus,
    });
  }

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const nextStep = steps.find((s) => !s.done);
  const firstName = userName ? userName.split(' ')[0] : null;

  return <section className={styles.onboarding}>
    <div className={styles.startHead}><div><p className={styles.eyebrow}>Primeros pasos</p>
      <h2>{firstName ? `Bienvenido, ${firstName}` : 'Empecemos'}</h2>
      <p>Dejá {orgDescriptor} listo en unos pocos pasos. Podés hacerlo a tu ritmo.</p></div>
      <span className={styles.stepCount}>{completed}/{total}</span></div>
    <ol className={styles.steps}>{steps.map(step => { const Icon=step.icon; return <li key={step.href}
      className={step.done ? styles.done : undefined} aria-current={step === nextStep ? 'step' : undefined}>
      {step.done ? <CheckCircle size={18} aria-label="Completado" /> : <Icon size={18} aria-hidden="true" />}
      <div><strong>{step.title}</strong>{!step.done ? <p>{step.description}</p> : null}</div>
      {!step.done ? <AppButtonLink variant="secondary" href={step.href}>{step.cta}<ArrowRight size={15} aria-hidden="true" /></AppButtonLink> : null}
    </li>;})}</ol>
  </section>;
}
