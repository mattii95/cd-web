import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Chequeo optimista: solo mira si hay cookie. La autorización real está en la DAL.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const login = new URL("/cuenta/login", request.url);
  login.searchParams.set("volver", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/cuenta/perfil", "/admin/:path*"],
};
