'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function getSafePassword(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const password = value.trim();

  if (!password) {
    return null;
  }

  return password;
}

export async function updateRecoveredPassword(formData: FormData) {
  const password = getSafePassword(formData.get('password'));
  const confirmPassword = getSafePassword(formData.get('confirmPassword'));

  if (!password || !confirmPassword) {
    redirect('/nueva-contrasena?estado=missing_fields');
  }

  if (password.length < 8) {
    redirect('/nueva-contrasena?estado=password_too_short');
  }

  if (password !== confirmPassword) {
    redirect('/nueva-contrasena?estado=passwords_do_not_match');
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/nueva-contrasena?estado=session_required');
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect('/nueva-contrasena?estado=update_failed');
  }

  await supabase.auth.signOut();

  redirect('/login?password_updated=1');
}