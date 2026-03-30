import { NextResponse, type NextRequest } from "next/server";

import {
  APP_SEARCH_HEADER,
  APP_PATHNAME_HEADER,
  AUTH_SESSION_COOKIE,
  AUTH_LOGIN_PATH,
  getAuthConfig,
  hasValidSessionToken,
  isLoginPath
} from "@/lib/auth";

const INTERNAL_CONTENT_CACHE_REVALIDATE_PATH =
  "/api/internal/content-cache/revalidate";

export function proxy(request: NextRequest) {
  const config = getAuthConfig();
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(APP_PATHNAME_HEADER, pathname);
  requestHeaders.set(APP_SEARCH_HEADER, search);

  if (!config.enabled) {
    return continueRequest(requestHeaders);
  }

  const isLoginPage = isLoginPath(pathname);
  const isInternalContentCacheRevalidate =
    pathname === INTERNAL_CONTENT_CACHE_REVALIDATE_PATH;
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const isAuthenticated = hasValidSessionToken(sessionToken);

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isLoginPage || isAuthenticated || isInternalContentCacheRevalidate) {
    return continueRequest(requestHeaders);
  }

  const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
  const destination = `${pathname}${request.nextUrl.search}`;

  if (!isLoginPath(destination)) {
    loginUrl.searchParams.set("next", destination);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|site.webmanifest).*)"
  ]
};

function continueRequest(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}
