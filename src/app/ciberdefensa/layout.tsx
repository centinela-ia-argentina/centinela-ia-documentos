import { notFound } from 'next/navigation';
import { isSeguridadFeatureEnabled } from '@/modules/seguridad/config';

export default function CiberdefensaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSeguridadFeatureEnabled()) {
    notFound();
  }

  return <>{children}</>;
}
