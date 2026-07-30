import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface AccessProfile {
  role?: string | null;
  status?: string | null;
}

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<NextResponse['cookies']['set']>[2];
};

function isPrivatePath(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/expedientes') ||
    pathname.startsWith('/documentos') ||
    pathname.startsWith('/usuarios') ||
    pathname.startsWith('/reportes') ||
    pathname.startsWith('/configuracion') ||
    pathname.startsWith('/plataforma') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/agente') ||
    pathname.startsWith('/calculadoras') ||
    pathname.startsWith('/modelos') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/herramientas') ||
    pathname.startsWith('/buscar') ||
    pathname.startsWith('/observaciones')
  );
}

function isAdminOnlyPath(pathname: string) {
  return (
    pathname.startsWith('/usuarios') ||
    pathname.startsWith('/configuracion')
  );
}

function isOperatorActionPath(pathname: string) {
  return (
    pathname.startsWith('/expedientes/nuevo') ||
    pathname.startsWith('/documentos/subir')
  );
}

function isClientRestrictedPath(pathname: string) {
  return (
    pathname.startsWith('/usuarios') ||
    pathname.startsWith('/reportes') ||
    pathname.startsWith('/configuracion') ||
    pathname.startsWith('/agente') ||
    pathname.startsWith('/calculadoras') ||
    pathname.startsWith('/modelos') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/herramientas') ||
    pathname.startsWith('/buscar')
  );
}

function isSensitiveReportPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const view = request.nextUrl.searchParams.get('vista');

  if (!pathname.startsWith('/reportes')) return false;

  return view === 'auditoria' || view === 'invitaciones';
}

function canAccessSensitiveReport(profile: AccessProfile, request: NextRequest) {
  const view = request.nextUrl.searchParams.get('vista');

  if (view === 'invitaciones') {
    return profile.role === 'admin';
  }

  if (view === 'auditoria') {
    return profile.role === 'admin' || profile.role === 'auditor';
  }

  return true;
}

function applySupabaseCookies(response: NextResponse, cookiesToSet: CookieToSet[]) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  cookiesToSet: CookieToSet[],
  motivo?: string
) {
  const url = request.nextUrl.clone();

  url.pathname = pathname;
  url.search = '';

  if (motivo) {
    url.searchParams.set('motivo', motivo);
  }

  const response = NextResponse.redirect(url);
  return applySupabaseCookies(response, cookiesToSet);
}

export async function updateSession(request: NextRequest) {
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookiesToSet) {
          nextCookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            cookiesToSet.push({ name, value, options });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPrivateRoute = isPrivatePath(pathname);

  if (isPrivateRoute && !user) {
    return redirectTo(request, '/login', cookiesToSet);
  }

  if (!user) {
    const response = NextResponse.next({ request });
    return applySupabaseCookies(response, cookiesToSet);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (pathname === '/login') {
    if (profile?.status === 'active') {
      return redirectTo(request, '/dashboard', cookiesToSet);
    }

    if (profile && profile.status !== 'active') {
      return redirectTo(request, '/acceso-denegado', cookiesToSet, 'estado');
    }

    const response = NextResponse.next({ request });
    return applySupabaseCookies(response, cookiesToSet);
  }

  if (isPrivateRoute && !profile && !pathname.startsWith('/onboarding')) {
    return redirectTo(request, '/onboarding', cookiesToSet);
  }

  if (isPrivateRoute && profile && profile.status !== 'active') {
    return redirectTo(request, '/acceso-denegado', cookiesToSet, 'estado');
  }

  if (isPrivateRoute && profile && isAdminOnlyPath(pathname)) {
    if (profile.role !== 'admin') {
      return redirectTo(request, '/acceso-denegado', cookiesToSet, 'rol');
    }
  }

  if (isPrivateRoute && profile?.role === 'client' && isClientRestrictedPath(pathname)) {
    return redirectTo(request, '/acceso-denegado', cookiesToSet, 'rol');
  }

  if (isPrivateRoute && profile && isOperatorActionPath(pathname)) {
    if (profile.role !== 'admin' && profile.role !== 'employee') {
      return redirectTo(request, '/acceso-denegado', cookiesToSet, 'rol');
    }
  }

  if (isPrivateRoute && profile && pathname.startsWith('/agente')) {
    if (profile.role !== 'admin' && profile.role !== 'employee') {
      return redirectTo(request, '/acceso-denegado', cookiesToSet, 'rol');
    }
  }

  if (isPrivateRoute && profile && isSensitiveReportPath(request)) {
    if (!canAccessSensitiveReport(profile, request)) {
      return redirectTo(request, '/acceso-denegado', cookiesToSet, 'rol');
    }
  }

  const response = NextResponse.next({ request });
  return applySupabaseCookies(response, cookiesToSet);
}
