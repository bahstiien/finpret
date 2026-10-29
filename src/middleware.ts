import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isNoindexPath, isProtectedPath } from "@/lib/redirect";

/** Protège les routes de l'application et marque les routes privées en noindex. */
export function middleware(request: NextRequest) {
  const response = handle(request);
  // Toutes les routes connectées (et connexion, API, invitations) sont en noindex, même si le robot les atteint.
  if (isNoindexPath(request.nextUrl.pathname)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function handle(request: NextRequest) {
  // Contrôle optimiste sur la présence du cookie : la session elle-même est vérifiée en base par chaque page
  // (requireUser), ce qui évite un aller-retour à la base à chaque requête.
  if (isProtectedPath(request.nextUrl.pathname) && !getSessionCookie(request)) return redirectToLogin(request);
  return NextResponse.next();
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
    // (rendues statiquement : pas de contrôle de session à chaque requête).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker|manifest.webmanifest|icons/|api/health$|recettes|menus|batch-cooking|og/).*)",
  ],
};
