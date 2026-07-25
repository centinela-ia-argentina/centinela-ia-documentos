import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const code = requestUrl.searchParams.get('code');
  let next = requestUrl.searchParams.get('next') ?? '/nueva-contrasena';

  const allowedNextPaths = new Set(['/nueva-contrasena']);
  if (!allowedNextPaths.has(next)) {
    next = '/nueva-contrasena';
  }

  if (token_hash && type === 'recovery') {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
    if (error) {
      return NextResponse.redirect(new URL('/recuperar-contrasena?estado=invalid_or_expired', requestUrl.origin));
    }
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/recuperar-contrasena?estado=invalid_or_expired', requestUrl.origin));
    }
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  return NextResponse.redirect(new URL('/recuperar-contrasena?estado=invalid_or_expired', requestUrl.origin));
}
