import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { SeguridadCuentaClient } from './SeguridadCuentaClient';

export default async function SeguridadCuentaPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          Configuración
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
          Seguridad de la cuenta
        </h2>
        <p className="mt-2 text-[13px] text-neutral-500">
          Gestioná la verificación en dos pasos (2FA).
        </p>
      </div>

      <SeguridadCuentaClient />
    </AppShell>
  );
}
