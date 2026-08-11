import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { ImagenAPdf } from './ImagenAPdf';
import { UnirPdf } from './UnirPdf';
import { ComprimirPdf } from './ComprimirPdf';
import { ConversorImagenes } from './ConversorImagenes';
import { UtilidadesTexto } from './UtilidadesTexto';
import { MotionCard } from '@/components/ui/MotionCard';
import { createClient } from '@/lib/supabase/server';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';

export default async function HerramientasPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();
  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const industry = normalizeIndustryType(orgData?.industry_type);

  const eyebrowTitle =
    industry === 'legal' ? 'Herramientas jurídicas' :
    industry === 'escribania' ? 'Herramientas notariales' :
    'Utilidades documentales';

  const subTitle = industry === 'inmobiliaria'
    ? 'Utilidades rápidas para preparar, revisar y convertir documentos de tus operaciones. Todo se procesa en tu navegador, sin subir nada a un servidor.'
    : 'Utilidades rápidas para tus documentos. Todo se procesa en tu navegador, sin subir nada a un servidor.';

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <MotionCard index={0} className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
            {eyebrowTitle}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Herramientas</h1>
          <p className="mt-1 text-sm text-slate-400">
            {subTitle}
          </p>
        </MotionCard>

        <MotionCard index={1} className="mt-8 p-6">
          <h2 className="text-lg font-semibold text-white">Imagen → PDF</h2>
          <p className="mt-1 text-sm text-slate-400">
            Convertí fotos o capturas en un PDF. Ideal para papeles
            fotografiados con el celular.
          </p>
          <div className="mt-4">
            <ImagenAPdf />
          </div>
        </MotionCard>

        <MotionCard index={2} className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-white">Unir PDF</h2>
          <p className="mt-1 text-sm text-slate-400">
            Combiná varios archivos PDF en uno solo, en el orden que quieras.
          </p>
          <div className="mt-4">
            <UnirPdf />
          </div>
        </MotionCard>

        <MotionCard index={3} className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-white">Comprimir PDF</h2>
          <p className="mt-1 text-sm text-slate-400">
            Reducí el peso de un PDF (ideal para escaneados). Elegí el nivel de compresión.
          </p>
          <div className="mt-4">
            <ComprimirPdf />
          </div>
        </MotionCard>

        <MotionCard index={4} className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-white">
            Conversor y compresor de imágenes
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Cambiá el formato (JPG ↔ PNG) o reducí el peso de tus imágenes.
          </p>
          <div className="mt-4">
            <ConversorImagenes />
          </div>
        </MotionCard>

        <MotionCard index={5} className="mt-6 p-6">
          <UtilidadesTexto />
        </MotionCard>
      </div>
    </AppShell>
  );
}
