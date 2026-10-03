import { createClient } from '@/lib/supabase/server';

export async function getUserProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { user, profile: null };
  }

  if (user.last_sign_in_at && profile.last_login_at !== user.last_sign_in_at) {
    try {
      await supabase
        .from('profiles')
        .update({ last_login_at: user.last_sign_in_at })
        .eq('id', user.id);
      profile.last_login_at = user.last_sign_in_at;
    } catch {
      // Ignorar fallo no bloqueante
    }
  }

  return { user, profile };
}