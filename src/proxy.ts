import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/recuperar-senha"];

/**
 * Renova a sessão do Supabase e protege as rotas /admin.
 * A autorização definitiva (ser membro da empresa) é verificada no servidor
 * em cada página/ação e no banco via RLS — este é apenas o primeiro portão.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    const isPublicAdmin = PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + "/"));
    if (!isLoggedIn && !isPublicAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      if (path !== "/admin") url.searchParams.set("next", path);
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
      return redirect;
    }
    if (isLoggedIn && path === "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};
