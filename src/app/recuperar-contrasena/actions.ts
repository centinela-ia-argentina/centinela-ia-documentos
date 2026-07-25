'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function getSafeEmail(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return email;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendPasswordRecoveryLink(formData: FormData) {
  const email = getSafeEmail(formData.get('email'));

  if (!email) {
    redirect('/recuperar-contrasena?estado=missing_email');
  }

  if (!isValidEmail(email)) {
    redirect('/recuperar-contrasena?estado=invalid_email');
  }

  const supabase = await createClient();
  const headersList = await headers();

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headersList.get('origin') ??
    'http://localhost:3000';

  const redirectTo = `${origin}/auth/callback?next=/nueva-contrasena`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect('/recuperar-contrasena?estado=send_failed');
  }

  redirect('/recuperar-contrasena?estado=sent');
}