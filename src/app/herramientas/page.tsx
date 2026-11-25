import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { ImagenAPdf } from './ImagenAPdf';
import { UnirPdf } from './UnirPdf';
import { ComprimirPdf } from './ComprimirPdf';
import { ConversorImagenes } from './ConversorImagenes';
import { UtilidadesTexto } from './UtilidadesTexto';
import { ToolsWorkspace } from './ToolsWorkspace';
import { canUploadDocument } from '@/lib/permissions/roles';

export default async function HerramientasPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const eyebrowTitle = 'Utilidades';

  const canSave = canUploadDocument(profile.role);
  return <AppShell><ToolsWorkspace eyebrow={eyebrowTitle} tools={[
    <ImagenAPdf key="image" canSave={canSave} />,
    <UnirPdf key="merge" canSave={canSave} />,
    <ComprimirPdf key="compress" canSave={canSave} />,
    <ConversorImagenes key="convert" />,
    <UtilidadesTexto key="text" />,
  ]} /></AppShell>;
}
