import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';
import { NewPropertyForm } from './NewPropertyForm';

export default async function NuevaPropiedadPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) redirect('/propiedades');
  return <AppShell><NewPropertyForm /></AppShell>;
}
