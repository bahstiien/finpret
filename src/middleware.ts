import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isNoindexPath, isProtectedPath } from "@/lib/redirect";

/** Rafraîchit la session Supabase à chaque requête et protège les routes de l'application. */
export async function middleware(request: NextRequest) {
  const response = await handle(request);
  // Toutes les routes connectées (et connexion, API, invitations) sont en noindex, même si le robot les atteint.
  if (isNoindexPath(request.nextUrl.pathname)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

async function handle(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  // Sans configuration Supabase, seules les pages publiques fonctionnent.
  if (!url || !key) {
    return protectedPath ? redirectToLogin(request) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valide le jeton auprès de Supabase : ne rien intercaler avant.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && protectedPath) return redirectToLogin(request);
  return response;
}

function redirectToLogin(request: NextRequest) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, le service worker, le manifest, les icônes et la sonde de santé et les pages publiques SEO
    // (rendues statiquement : pas d'appel Supabase à chaque requête).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker|manifest.webmanifest|icons/|api/health$|recettes|menus|batch-cooking|og/).*)",
  ],
};
