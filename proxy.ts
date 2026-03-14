import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  getAuthConfig,
  verifySessionToken
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const config = getAuthConfig();

  if (!config.enabled) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const isAuthenticated =
    typeof sessionToken === "string" && verifySessionToken(sessionToken);

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isLoginPage || isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const destination = `${pathname}${request.nextUrl.search}`;

  if (destination !== "/login") {
    loginUrl.searchParams.set("next", destination);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico|mp3|ogg|wav|txt|xml|webmanifest)$).*)"
  ]
};
